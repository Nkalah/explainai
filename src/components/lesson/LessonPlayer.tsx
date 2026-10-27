import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { create, all } from "mathjs";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import type { LessonStepExplanationMode, LessonStepExplanationState } from "@/lib/parseLesson";
import { isCorrectUnderstandingAnswer } from "@/lib/parseLesson";

const math = create(all);
const StepExplanationMarkdown = lazy(() => import("@/components/chat/ChatMarkdown"));

const chalkColors: Record<string, string> = {
  blue: "#7cc9ff",
  red: "#ff7a7a",
  green: "#7ae5a1",
  yellow: "#f6d77d",
  white: "#e5edf6",
  muted: "#9bb0c7",
};

const implementedActions = new Set([
  "drawAxes",
  "plotFunction",
  "plotPoints",
  "movePoint",
  "showLabel",
  "drawLine",
  "drawSegment",
  "drawVector",
  "tangentLine",
  "shadeArea",
  "drawShape",
  "equationStep",
  "highlight",
  "fade",
  "numberLine",
  "hopArrow",
  "cycleWheel",
  "calendarGrid",
  "table",
  "stepCards",
  "counter",
  "brace",
  "textBlock",
  "flowNode",
  "flowArrow",
  "timeline",
]);
const graphActions = new Set([
  "plotFunction",
  "plotPoints",
  "movePoint",
  "tangentLine",
  "shadeArea",
]);

type View = {
  xRange: [number, number];
  yRange: [number, number];
  grid?: boolean;
  axes?: boolean;
};

type LessonAction = {
  t: number;
  do: string;
  duration?: number;
  [key: string]: unknown;
};

type LessonScene = {
  id: number;
  planSceneId: string;
  stepRefs: string[];
  visualPurpose: string | null;
  caption: string;
  narration: string;
  section?: string;
  doing?: string;
  why?: string;
  changed?: string;
  remember?: string;
  duration: number;
  view: View;
  actions: LessonAction[];
  equation?: { latex?: string; reveal?: string };
};

export type Lesson = {
  title: string;
  level?: string;
  scenes: LessonScene[];
  solution: {
    question: string;
    given: string[];
    find: string;
    method: string;
    variables: { symbol: string; definition: string; units: string | null }[];
    answer: string;
    exactValue: string | null;
    approximateValue: string | null;
    units: string | null;
    steps: {
      id: string;
      questionPart: string;
      role: string;
      reasoning: string;
      calculationRefs: string[];
    }[];
    calculations: {
      id: string;
      expression: string;
      result: string;
      units: string | null;
    }[];
    finalCalculationId: string | null;
    verification: string;
  };
  takeaway: string;
  challenge: {
    question: string;
    hint: string;
    answer: string;
    explanation?: string;
    remediation?: {
      likelyMisconception: string;
      simplerQuestion: string;
      simplerHint: string;
      simplerAnswer: string;
      explanation: string;
      stepRef: string;
    };
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const easeOutCubic = (value: number) => 1 - (1 - clamp(value, 0, 1)) ** 3;

const safeNumber = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

function toScreen(x: number, y: number, view: View, width: number, height: number) {
  const [xMin, xMax] = view.xRange ?? [-10, 10];
  const [yMin, yMax] = view.yRange ?? [-10, 10];
  const spanX = xMax - xMin || 1;
  const spanY = yMax - yMin || 1;
  const padX = 64;
  const padY = 46;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;
  const px = padX + ((x - xMin) / spanX) * innerWidth;
  const py = height - padY - ((y - yMin) / spanY) * innerHeight;
  return { x: px, y: py };
}

function toNumberList(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => safeNumber(item));
  }
  return [];
}

function normalizePoint(value: unknown): { x: number; y: number } | null {
  if (Array.isArray(value) && value.length >= 2) {
    return { x: safeNumber(value[0]), y: safeNumber(value[1]) };
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.x === "number" || typeof record.x === "string") {
      return { x: safeNumber(record.x), y: safeNumber(record.y ?? 0) };
    }
  }
  return null;
}

function evaluateExpr(expr: string, x: number) {
  try {
    const result = math.evaluate(expr, { x });
    return Number(result);
  } catch {
    return Number.NaN;
  }
}

function derivativeAt(expr: string, x: number) {
  try {
    const derivative = math.derivative(expr, "x");
    return Number(derivative.evaluate({ x }));
  } catch {
    return Number.NaN;
  }
}

function collectFunctionPoints(expr: string, view: View, sampleCount = 220) {
  const [minX, maxX] = view.xRange;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= sampleCount; i += 1) {
    const x = minX + ((maxX - minX) * i) / sampleCount;
    const y = evaluateExpr(expr, x);
    if (Number.isFinite(y)) {
      points.push({ x, y });
    }
  }

  return points;
}

function buildFunctionPath(expr: string, view: View, width: number, height: number) {
  const points = collectFunctionPoints(expr, view);
  if (points.length === 0) return "";

  const pathSegments: string[] = [];
  points.forEach((point, index) => {
    const screen = toScreen(point.x, point.y, view, width, height);
    pathSegments.push(`${index === 0 ? "M" : "L"} ${screen.x.toFixed(2)} ${screen.y.toFixed(2)}`);
  });

  return pathSegments.join(" ");
}

function buildAreaPath(
  expr: string,
  startX: number,
  endX: number,
  view: View,
  width: number,
  height: number,
) {
  const points: { x: number; y: number }[] = [];
  const sampleCount = 120;

  for (let i = 0; i <= sampleCount; i += 1) {
    const x = startX + ((endX - startX) * i) / sampleCount;
    const y = evaluateExpr(expr, x);
    if (Number.isFinite(y)) {
      points.push({ x, y });
    }
  }

  if (points.length === 0) return "";

  const first = toScreen(points[0].x, 0, view, width, height);
  const segments = [`M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`];

  points.forEach((point) => {
    const screen = toScreen(point.x, point.y, view, width, height);
    segments.push(`L ${screen.x.toFixed(2)} ${screen.y.toFixed(2)}`);
  });

  const last = toScreen(points[points.length - 1].x, 0, view, width, height);
  segments.push(`L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`);
  segments.push("Z");

  return segments.join(" ");
}

function renderMath(latex: string, options: { displayMode?: boolean } = {}) {
  return katex.renderToString(latex.replace(/[\u00a0\u202f]/g, " "), {
    throwOnError: false,
    displayMode: options.displayMode ?? false,
    output: "htmlAndMathml",
  });
}

function renderMathLabel(value: unknown): string {
  const label = String(value ?? "");
  if (label.startsWith("$") && label.endsWith("$")) {
    return renderMath(label.slice(1, -1));
  }
  if (label.includes("\\") || /[_^]/.test(label)) return renderMath(label);
  const escaped = label.replace(/[#$%&_{}]/g, "\\$&").replace(/~/g, "\\textasciitilde{}");
  return renderMath(`\\text{${escaped}}`);
}

function foreignMathLabel(label: unknown, fontSize = 20, stageScale = 1) {
  return (
    <div
      style={{
        color: chalkColors.white,
        fontSize: fontSize / stageScale,
        lineHeight: 1.2,
        textAlign: "center",
      }}
      dangerouslySetInnerHTML={{ __html: renderMathLabel(label) }}
    />
  );
}

export const LessonPlayer = memo(LessonPlayerView);

function LessonBoard({
  scene,
  previousScene,
  elapsed,
  reducedMotion,
  isVisible,
  onStageClick,
  onTouchStart,
  onTouchEnd,
}: {
  scene: LessonScene;
  previousScene?: LessonScene;
  elapsed: number;
  reducedMotion: boolean;
  isVisible: boolean;
  onStageClick: () => void;
  onTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLDivElement>) => void;
}) {
  const width = 800;
  const [height, setHeight] = useState(500);
  const [stageWidth, setStageWidth] = useState(width);
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: stageWidth, height: stageHeight } = entry.contentRect;
      if (stageWidth > 0 && stageHeight > 0) {
        setStageWidth(stageWidth);
        setHeight(Math.round((width * stageHeight) / stageWidth));
      }
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const stageScale = Math.max(0.1, stageWidth / width);
  const renderStageLabel = (label: unknown, fontSize = 20) =>
    foreignMathLabel(label, fontSize, stageScale);

  const view = useMemo<View>(() => {
    const defaultView: View = { xRange: [-4, 4], yRange: [-2, 10], grid: false, axes: false };
    return {
      ...defaultView,
      ...scene.view,
      xRange: scene.view?.xRange ?? defaultView.xRange,
      yRange: scene.view?.yRange ?? defaultView.yRange,
      grid: Boolean(scene.view?.grid ?? false),
      axes: Boolean(scene.view?.axes ?? false),
    };
  }, [scene.view]);
  const hasGraphAction = useMemo(
    () => scene.actions.some((action) => graphActions.has(action.do)),
    [scene.actions],
  );
  const shouldShowGrid = view.grid || hasGraphAction;
  const shouldShowAxes = view.axes || hasGraphAction;
  const renderActions = useMemo(() => {
    const hasVisualAction = scene.actions.some((action) => {
      if (!implementedActions.has(action.do)) return false;
      if (action.do === "drawAxes") return shouldShowGrid || shouldShowAxes;
      if (action.do === "table")
        return (
          (Array.isArray(action.headers) && action.headers.length > 0) ||
          (Array.isArray(action.rows) && action.rows.length > 0)
        );
      if (action.do === "stepCards") return Array.isArray(action.cards) && action.cards.length > 0;
      if (action.do === "cycleWheel") return Array.isArray(action.slots) && action.slots.length > 1;
      if (action.do === "timeline") return Array.isArray(action.events) && action.events.length > 0;
      return true;
    });
    return hasVisualAction
      ? scene.actions
      : [
          {
            t: 0,
            duration: scene.duration,
            do: "stepCards",
            cards: [{ title: scene.caption, body: scene.narration, latex: scene.equation?.latex }],
          } satisfies LessonAction,
        ];
  }, [
    scene.actions,
    scene.caption,
    scene.duration,
    scene.equation?.latex,
    scene.narration,
    shouldShowAxes,
    shouldShowGrid,
  ]);
  const staticActionPaths = useMemo(() => {
    const paths = new Map<LessonAction, string>();
    for (const action of renderActions) {
      if (action.do === "plotFunction") {
        const expr = typeof action.expr === "string" ? action.expr : "x^2";
        paths.set(action, buildFunctionPath(expr, view, width, height));
      } else if (action.do === "shadeArea") {
        const expr = typeof action.expr === "string" ? action.expr : "x^2";
        const startX = safeNumber(
          action.x1 ?? action.from ?? action.start ?? view.xRange[0],
          view.xRange[0],
        );
        const endX = safeNumber(
          action.x2 ?? action.to ?? action.end ?? view.xRange[1],
          view.xRange[1],
        );
        paths.set(
          action,
          buildAreaPath(expr, Math.min(startX, endX), Math.max(startX, endX), view, width, height),
        );
      }
    }
    return paths;
  }, [height, renderActions, view]);
  const activeActionIndex = renderActions.reduce(
    (activeIndex, action, index) =>
      action.do !== "drawAxes" && elapsed >= action.t ? index : activeIndex,
    -1,
  );
  const unknownActionTypes = [
    ...new Set(
      scene.actions.map((action) => action.do).filter((type) => !implementedActions.has(type)),
    ),
  ];
  const unknownActionKey = unknownActionTypes.join("|");

  useEffect(() => {
    for (const actionType of unknownActionKey.split("|").filter(Boolean)) {
      console.warn(`Skipped unsupported lesson action: ${actionType}`);
    }
  }, [scene.id, unknownActionKey]);

  const xMin = view.xRange[0];
  const xMax = view.xRange[1];
  const yMin = view.yRange[0];
  const yMax = view.yRange[1];

  const gridLines = useMemo(() => {
    const lines = [] as React.ReactNode[];
    if (!shouldShowGrid) return lines;
    for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x += 1) {
      const a = toScreen(x, yMin, view, width, height);
      const b = toScreen(x, yMax, view, width, height);
      lines.push(
        <line
          key={`v-${x}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="rgba(148,163,184,0.18)"
          strokeWidth={1}
        />,
      );
    }

    for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y += 1) {
      const a = toScreen(xMin, y, view, width, height);
      const b = toScreen(xMax, y, view, width, height);
      lines.push(
        <line
          key={`h-${y}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="rgba(148,163,184,0.18)"
          strokeWidth={1}
        />,
      );
    }
    return lines;
  }, [height, shouldShowGrid, view, width, xMax, xMin, yMax, yMin]);

  const axisNodes = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    if (!shouldShowAxes) return nodes;
    const zeroX = clamp(0, xMin, xMax);
    const zeroY = clamp(0, yMin, yMax);
    const xAxisStart = toScreen(xMin, 0, view, width, height);
    const xAxisEnd = toScreen(xMax, 0, view, width, height);
    const yAxisStart = toScreen(0, yMin, view, width, height);
    const yAxisEnd = toScreen(0, yMax, view, width, height);
    nodes.push(
      <g key="axes" opacity={1}>
        <line
          x1={xAxisStart.x}
          y1={xAxisStart.y}
          x2={xAxisEnd.x}
          y2={xAxisEnd.y}
          stroke="#dfeaf6"
          strokeWidth={2.6}
          opacity={0.9}
        />
        <line
          x1={yAxisStart.x}
          y1={yAxisStart.y}
          x2={yAxisEnd.x}
          y2={yAxisEnd.y}
          stroke="#dfeaf6"
          strokeWidth={2.6}
          opacity={0.9}
        />
        <text
          x={width - 52}
          y={yAxisStart.y - 10}
          fill="#dfeaf6"
          fontSize={16 / stageScale}
          fontWeight={600}
        >
          y
        </text>
        <text
          x={xAxisEnd.x - 18}
          y={height - 18}
          fill="#dfeaf6"
          fontSize={16 / stageScale}
          fontWeight={600}
        >
          x
        </text>
        {zeroX >= xMin && zeroX <= xMax && zeroY >= yMin && zeroY <= yMax ? (
          <circle
            cx={toScreen(0, 0, view, width, height).x}
            cy={toScreen(0, 0, view, width, height).y}
            r={3.5}
            fill="#e5edf6"
          />
        ) : null}
      </g>,
    );
    return nodes;
  }, [height, shouldShowAxes, stageScale, view, width, xMax, xMin, yMax, yMin]);

  const renderAction = (action: LessonAction) => {
    const duration = safeNumber(action.dur, safeNumber(action.duration, 0.8));
    const localElapsed = elapsed - action.t;
    const reveal = clamp(localElapsed / duration, 0, 1);

    if (elapsed < action.t && !(action.do === "drawAxes" && elapsed >= action.t - 0.1)) {
      return null;
    }

    switch (action.do) {
      case "numberLine": {
        const start = safeNumber(action.from, 0);
        const end = safeNumber(action.to, 10);
        const step = safeNumber(action.step, 1);
        if (step <= 0 || end <= start) return null;
        const baseline = toScreen(0, clamp(0, yMin, yMax), view, width, height).y;
        const marks = new Set(toNumberList(action.marks));
        const tickCount = Math.min(120, Math.floor((end - start) / step));
        return (
          <g key={`${scene.id}-${action.t}-numberLine`} opacity={Math.max(0.2, reveal)}>
            <line
              x1={toScreen(start, 0, view, width, height).x}
              y1={baseline}
              x2={toScreen(end, 0, view, width, height).x}
              y2={baseline}
              stroke={chalkColors.white}
              strokeWidth={3}
            />
            {Array.from({ length: tickCount + 1 }, (_, index) => {
              const value = start + index * step;
              const x = toScreen(value, 0, view, width, height).x;
              const marked = marks.has(value);
              return (
                <g key={index}>
                  <line
                    x1={x}
                    y1={baseline - (marked ? 16 : 10)}
                    x2={x}
                    y2={baseline + (marked ? 16 : 10)}
                    stroke={marked ? chalkColors.yellow : chalkColors.white}
                    strokeWidth={marked ? 3 : 2}
                  />
                  <foreignObject x={x - 38} y={baseline + 14} width={76} height={34}>
                    {renderStageLabel(value)}
                  </foreignObject>
                </g>
              );
            })}
          </g>
        );
      }
      case "hopArrow": {
        const from = safeNumber(action.from, 0);
        const to = safeNumber(action.to, from + 1);
        const baseline = toScreen(0, clamp(0, yMin, yMax), view, width, height).y;
        const startX = toScreen(from, 0, view, width, height).x;
        const endX = toScreen(to, 0, view, width, height).x;
        const arcHeight = Math.max(36, Math.min(130, Math.abs(endX - startX) * 0.35));
        const controlY = baseline - arcHeight;
        const progress = reducedMotion ? 1 : easeOutCubic(reveal);
        const markerX =
          (1 - progress) ** 2 * startX +
          2 * (1 - progress) * progress * ((startX + endX) / 2) +
          progress ** 2 * endX;
        const markerY =
          (1 - progress) ** 2 * baseline +
          2 * (1 - progress) * progress * controlY +
          progress ** 2 * baseline;
        return (
          <g key={`${scene.id}-${action.t}-hopArrow`} opacity={Math.max(0.2, reveal)}>
            <path
              d={`M ${startX} ${baseline} Q ${(startX + endX) / 2} ${controlY} ${endX} ${baseline}`}
              fill="none"
              stroke={chalkColors.yellow}
              strokeWidth={4}
            />
            <polygon
              points={`${endX},${baseline} ${endX - 13},${baseline - 5} ${endX - 9},${baseline - 16}`}
              fill={chalkColors.yellow}
            />
            <circle
              cx={markerX}
              cy={markerY}
              r={10}
              fill={chalkColors.yellow}
              stroke="#fff4c2"
              strokeWidth={3}
            />
            {action.label !== undefined ? (
              <foreignObject x={(startX + endX) / 2 - 58} y={controlY - 30} width={116} height={32}>
                {renderStageLabel(action.label)}
              </foreignObject>
            ) : null}
          </g>
        );
      }
      case "cycleWheel": {
        const slots = Array.isArray(action.slots) ? action.slots.map(String) : [];
        if (slots.length < 2) return null;
        const markerName = String(action.marker ?? slots[0]);
        const markerIndex = Math.max(0, slots.indexOf(markerName));
        const moveBy = safeNumber(action.moveBy, 0);
        const center = { x: width / 2, y: height / 2 + 12 };
        const radius = Math.min(width, height) * 0.3;
        const visualMoves = Math.abs(moveBy) % slots.length;
        const direction = moveBy < 0 ? -1 : 1;
        const movedProgress = (reducedMotion ? 1 : reveal) * visualMoves;
        const completedHops = Math.min(visualMoves, Math.floor(movedProgress));
        const hopFraction =
          movedProgress >= visualMoves ? 0 : easeOutCubic(movedProgress - completedHops);
        const markerAngle =
          -Math.PI / 2 +
          ((markerIndex + direction * (completedHops + hopFraction)) * Math.PI * 2) / slots.length;
        const markerPoint = {
          x: center.x + Math.cos(markerAngle) * radius,
          y: center.y + Math.sin(markerAngle) * radius,
        };
        const currentSlot =
          slots[
            (((markerIndex + direction * (completedHops + (hopFraction >= 0.5 ? 1 : 0))) %
              slots.length) +
              slots.length) %
              slots.length
          ];
        const targetIndex = (((markerIndex + moveBy) % slots.length) + slots.length) % slots.length;
        const targetAngle = -Math.PI / 2 + (targetIndex * Math.PI * 2) / slots.length;
        const targetLabelPoint = {
          x: center.x + Math.cos(targetAngle) * (radius + 38),
          y: center.y + Math.sin(targetAngle) * (radius + 38),
        };
        const sourceAngle = -Math.PI / 2 + (markerIndex * Math.PI * 2) / slots.length;
        const sourceLabelPoint = {
          x: center.x + Math.cos(sourceAngle) * (radius + 38),
          y: center.y + Math.sin(sourceAngle) * (radius + 38),
        };
        return (
          <g key={`${scene.id}-${action.t}-cycleWheel`}>
            <circle
              cx={center.x}
              cy={center.y}
              r={radius}
              fill="none"
              stroke={chalkColors.blue}
              strokeWidth={4}
              opacity={0.8}
            />
            <circle
              cx={sourceLabelPoint.x}
              cy={sourceLabelPoint.y}
              r={25}
              fill="none"
              stroke={chalkColors.white}
              strokeWidth={2}
              strokeDasharray="4 5"
              opacity={0.55}
            />
            <circle
              cx={targetLabelPoint.x}
              cy={targetLabelPoint.y}
              r={27}
              fill="none"
              stroke={chalkColors.yellow}
              strokeWidth={3}
              filter="url(#lesson-active-glow)"
            />
            {slots.map((slot, index) => {
              const angle = -Math.PI / 2 + (index * Math.PI * 2) / slots.length;
              const x = center.x + Math.cos(angle) * (radius + 38);
              const y = center.y + Math.sin(angle) * (radius + 38);
              return (
                <foreignObject
                  key={`${slot}-${index}`}
                  x={x - 48}
                  y={y - 17}
                  width={96}
                  height={36}
                  opacity={index === targetIndex ? 1 : 0.78}
                >
                  {renderStageLabel(slot, 17)}
                </foreignObject>
              );
            })}
            <line
              x1={center.x}
              y1={center.y}
              x2={markerPoint.x}
              y2={markerPoint.y}
              stroke={chalkColors.yellow}
              strokeWidth={5}
            />
            <circle
              cx={markerPoint.x}
              cy={markerPoint.y}
              r={19}
              fill={chalkColors.yellow}
              opacity={0.16}
            />
            <circle
              cx={markerPoint.x}
              cy={markerPoint.y}
              r={13}
              fill={chalkColors.yellow}
              stroke="#fff4c2"
              strokeWidth={3}
              filter="url(#lesson-active-glow)"
            />
            <foreignObject x={center.x - 90} y={center.y - 22} width={180} height={44}>
              {elapsed - action.t < 0.6 ? (
                <div
                  style={{
                    color: chalkColors.white,
                    fontSize: 20 / stageScale,
                    textAlign: "center",
                    textDecoration: "line-through",
                    opacity: 0.58 * (1 - clamp((elapsed - action.t) / 0.6, 0, 1)),
                  }}
                >
                  {markerName}
                </div>
              ) : (
                renderStageLabel(currentSlot === undefined ? markerName : currentSlot, 24)
              )}
            </foreignObject>
            {typeof scene.why === "string" && scene.why.trim() ? (
              <foreignObject x={center.x - 230} y={height - 45} width={460} height={32}>
                <div className="lesson-visual-why">{scene.why}</div>
              </foreignObject>
            ) : null}
          </g>
        );
      }
      case "calendarGrid": {
        const year = Math.trunc(safeNumber(action.year, new Date().getUTCFullYear()));
        const month = clamp(Math.trunc(safeNumber(action.month, 1)), 1, 12);
        const highlightedDay = Math.trunc(safeNumber(action.highlightDay, -1));
        const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en", {
          month: "long",
          timeZone: "UTC",
        });
        const highlight =
          typeof action.highlightColor === "string"
            ? (chalkColors[action.highlightColor] ?? chalkColors.yellow)
            : chalkColors.yellow;
        const left = width * 0.04;
        const top = height * 0.31;
        const cellWidth = (width - left * 2) / 7;
        const cellHeight = (height - top - 24) / 6;
        const previousCalendar = previousScene?.actions.find((item) => item.do === "calendarGrid");
        const previousDay = previousCalendar
          ? Math.trunc(safeNumber(previousCalendar.highlightDay, -1))
          : -1;
        const selectedCellIndex = highlightedDay - 1 + firstWeekday;
        const selectedWeekdayColumn = selectedCellIndex >= 0 ? selectedCellIndex % 7 : -1;
        const selectedWeekdayX =
          selectedWeekdayColumn >= 0
            ? left + selectedWeekdayColumn * cellWidth + (cellWidth - 3) / 2
            : 0;
        return (
          <g key={`${scene.id}-${action.t}-calendarGrid`} opacity={Math.max(0.15, reveal)}>
            <foreignObject
              x={left}
              y={height * 0.04}
              width={width - left * 2}
              height={height * 0.12}
            >
              {renderStageLabel(`${monthName} ${year}`, 26)}
            </foreignObject>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => (
              <foreignObject
                key={day}
                x={left + index * cellWidth}
                y={top - 29}
                width={cellWidth}
                height={28}
              >
                {renderStageLabel(day, 16)}
              </foreignObject>
            ))}
            {selectedWeekdayColumn >= 0 ? (
              <rect
                x={left + selectedWeekdayColumn * cellWidth + 3}
                y={top - 28}
                width={cellWidth - 8}
                height={25}
                rx={5}
                fill="none"
                stroke="#dfeaf6"
                strokeWidth={1.5}
                opacity={0.8}
              />
            ) : null}
            {Array.from({ length: 42 }, (_, index) => {
              const day = index - firstWeekday + 1;
              const validDay = day >= 1 && day <= daysInMonth;
              const selected = validDay && day === highlightedDay;
              const x = left + (index % 7) * cellWidth;
              const y = top + Math.floor(index / 7) * cellHeight;
              const weekdayColumn = index % 7;
              return (
                <g key={index}>
                  {selected ? (
                    <line
                      x1={selectedWeekdayX}
                      y1={top - 3}
                      x2={selectedWeekdayX}
                      y2={y}
                      stroke="#dfeaf6"
                      strokeWidth={1.5}
                      strokeDasharray="4 5"
                      opacity={0.75}
                    />
                  ) : null}
                  <rect
                    x={x}
                    y={y}
                    width={cellWidth - 3}
                    height={cellHeight - 3}
                    rx={7}
                    fill={selected ? highlight : "rgba(15,23,42,0.3)"}
                    fillOpacity={selected ? 0.35 : 1}
                    stroke={selected ? highlight : "rgba(148,163,184,0.35)"}
                    strokeWidth={selected ? 3 : 1}
                    filter={selected ? "url(#lesson-active-glow)" : undefined}
                  />
                  {validDay ? (
                    <foreignObject
                      x={x + 2}
                      y={y + 4}
                      width={cellWidth - 8}
                      height={cellHeight - 8}
                    >
                      {selected &&
                      previousDay > 0 &&
                      previousDay !== day &&
                      elapsed - action.t < 0.6 ? (
                        <div
                          style={{
                            color: chalkColors.white,
                            textAlign: "center",
                            textDecoration: "line-through",
                            opacity: 0.58 * (1 - clamp((elapsed - action.t) / 0.6, 0, 1)),
                          }}
                        >
                          {previousDay}
                        </div>
                      ) : selected ? (
                        <div
                          className={!reducedMotion ? "lesson-value-arrive" : ""}
                          dangerouslySetInnerHTML={{ __html: renderMathLabel(day) }}
                        />
                      ) : (
                        renderStageLabel(day, 17)
                      )}
                    </foreignObject>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      }
      case "table": {
        const headers = Array.isArray(action.headers) ? action.headers : [];
        const rows = Array.isArray(action.rows)
          ? (action.rows.filter(Array.isArray) as unknown[][])
          : [];
        const columnCount = Math.max(1, headers.length, ...rows.map((row) => row.length));
        const highlightRow = Math.trunc(safeNumber(action.highlightRow, -1));
        const cellTarget = Array.isArray(action.highlightCell)
          ? {
              row: safeNumber(action.highlightCell[0], -1),
              column: safeNumber(action.highlightCell[1], -1),
            }
          : typeof action.highlightCell === "object" && action.highlightCell !== null
            ? {
                row: safeNumber((action.highlightCell as Record<string, unknown>).row, -1),
                column: safeNumber((action.highlightCell as Record<string, unknown>).column, -1),
              }
            : null;
        const previousTable = previousScene?.actions.find((item) => item.do === "table");
        const previousRows = Array.isArray(previousTable?.rows)
          ? (previousTable.rows.filter(Array.isArray) as unknown[][])
          : [];
        const tableCell = (
          value: unknown,
          rowIndex: number,
          columnIndex: number,
          isHeader = false,
        ) => {
          const primarySelected = cellTarget?.row === rowIndex && cellTarget.column === columnIndex;
          const rowSelected = rowIndex === highlightRow;
          const selected = primarySelected || rowSelected;
          const previousValue = rowIndex >= 0 ? previousRows[rowIndex]?.[columnIndex] : undefined;
          const valueChanged =
            selected && previousValue !== undefined && String(previousValue) !== String(value);
          const showPreviousValue = valueChanged && elapsed - action.t < 0.6;
          return (
            <div
              key={`${rowIndex}-${columnIndex}`}
              style={{
                position: "relative",
                zIndex: 1,
                border: `1px solid ${primarySelected ? chalkColors.yellow : rowSelected ? "rgba(223,234,246,0.72)" : "rgba(148,163,184,0.45)"}`,
                background: primarySelected
                  ? "rgba(246,215,125,0.18)"
                  : rowSelected
                    ? "rgba(246,215,125,0.07)"
                    : isHeader
                      ? "rgba(15,23,42,0.8)"
                      : "rgba(15,23,42,0.35)",
                padding: "12px 10px",
                minHeight: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: chalkColors.white,
                boxShadow: primarySelected ? "0 0 14px rgba(246,215,125,0.34)" : undefined,
                transition: "border-color 250ms ease-out, box-shadow 250ms ease-out",
              }}
            >
              {showPreviousValue ? (
                <del
                  className="lesson-previous-value"
                  style={{ opacity: 1 - clamp((elapsed - action.t) / 0.6, 0, 1) }}
                >
                  {String(previousValue)}
                </del>
              ) : (
                <div
                  className={primarySelected && !reducedMotion ? "lesson-value-arrive" : ""}
                  dangerouslySetInnerHTML={{ __html: renderMathLabel(value) }}
                />
              )}
            </div>
          );
        };
        const activeRowCells =
          cellTarget && rows[cellTarget.row]
            ? Array.from({ length: columnCount }, (_, columnIndex) => columnIndex).filter(
                (columnIndex) => columnIndex !== cellTarget.column,
              )
            : [];
        return (
          <foreignObject
            key={`${scene.id}-${action.t}-table`}
            x={54}
            y={100}
            width={932}
            height={430}
            opacity={Math.max(0.15, reveal)}
          >
            <div
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                gap: 2,
                fontSize: 18 / stageScale,
              }}
            >
              {activeRowCells.length > 0 ? (
                <svg
                  className="lesson-table-connectors"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {activeRowCells.map((columnIndex) => (
                    <line
                      key={columnIndex}
                      x1={`${((columnIndex + 0.5) / columnCount) * 100}%`}
                      y1={`${((cellTarget!.row + 1.5) / (rows.length + 1)) * 100}%`}
                      x2={`${((cellTarget!.column + 0.5) / columnCount) * 100}%`}
                      y2={`${((cellTarget!.row + 1.5) / (rows.length + 1)) * 100}%`}
                    />
                  ))}
                </svg>
              ) : null}
              {headers.map((header, columnIndex) => tableCell(header, -1, columnIndex, true))}
              {rows.flatMap((row, rowIndex) =>
                Array.from({ length: columnCount }, (_, columnIndex) =>
                  tableCell(row[columnIndex] ?? "", rowIndex, columnIndex),
                ),
              )}
            </div>
          </foreignObject>
        );
      }
      case "stepCards": {
        const cards = Array.isArray(action.cards)
          ? (action.cards.filter((card) => typeof card === "object" && card !== null) as Record<
              string,
              unknown
            >[])
          : [];
        if (cards.length === 0) return null;
        const left = 58;
        const gap = 14;
        const cardWidth = (width - left * 2 - gap * (cards.length - 1)) / cards.length;
        const stagger = safeNumber(action.stagger, 0.45);
        return (
          <g key={`${scene.id}-${action.t}-stepCards`}>
            {cards.map((card, index) => {
              const cardReveal = clamp((elapsed - action.t - index * stagger) / 0.45, 0, 1);
              if (cardReveal <= 0) return null;
              return (
                <foreignObject
                  key={index}
                  x={left + index * (cardWidth + gap)}
                  y={138 + (1 - cardReveal) * 35}
                  width={cardWidth}
                  height={344}
                  opacity={cardReveal}
                >
                  <div
                    style={{
                      height: "100%",
                      border: `1px solid ${chalkColors.blue}`,
                      borderRadius: 14,
                      padding: 20,
                      background: "rgba(15,23,42,0.88)",
                      color: chalkColors.white,
                      boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
                    }}
                  >
                    <div
                      style={{ fontSize: 21 / stageScale, fontWeight: 700, marginBottom: 15 }}
                      dangerouslySetInnerHTML={{
                        __html: renderMathLabel(card.title ?? `Step ${index + 1}`),
                      }}
                    />
                    <div
                      style={{ fontSize: 17 / stageScale, lineHeight: 1.45 }}
                      dangerouslySetInnerHTML={{ __html: renderMathLabel(card.body ?? "") }}
                    />
                    {typeof card.latex === "string" ? (
                      <div
                        style={{ marginTop: 20, fontSize: 22 / stageScale }}
                        dangerouslySetInnerHTML={{ __html: renderMath(card.latex) }}
                      />
                    ) : null}
                  </div>
                </foreignObject>
              );
            })}
          </g>
        );
      }
      case "counter": {
        const start = safeNumber(action.from, 0);
        const end = safeNumber(action.to, 1);
        const value = start + (end - start) * reveal;
        const display =
          Number.isInteger(start) && Number.isInteger(end)
            ? String(Math.round(value))
            : value.toFixed(2);
        const label = action.label ? `${String(action.label)} = ${display}` : display;
        return (
          <foreignObject
            key={`${scene.id}-${action.t}-counter`}
            x={width / 2 - 180}
            y={height / 2 - 70}
            width={360}
            height={140}
            opacity={Math.max(0.15, reveal)}
          >
            <div
              style={{
                height: "100%",
                border: `2px solid ${chalkColors.green}`,
                borderRadius: 16,
                background: "rgba(15,23,42,0.88)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: chalkColors.white,
                fontSize: 34 / stageScale,
                fontWeight: 700,
              }}
              dangerouslySetInnerHTML={{ __html: renderMathLabel(label) }}
            />
          </foreignObject>
        );
      }
      case "brace": {
        const target = action.target;
        let from: { x: number; y: number } | null = null;
        let to: { x: number; y: number } | null = null;
        if (Array.isArray(target) && target.length >= 4) {
          from = { x: safeNumber(target[0]), y: safeNumber(target[1]) };
          to = { x: safeNumber(target[2]), y: safeNumber(target[3]) };
        } else if (typeof target === "object" && target !== null) {
          const points = target as Record<string, unknown>;
          from = normalizePoint(points.from);
          to = normalizePoint(points.to);
        }
        if (!from || !to) return null;
        const start = toScreen(from.x, from.y, view, width, height);
        const end = toScreen(to.x, to.y, view, width, height);
        const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
        const path = horizontal
          ? `M ${start.x} ${start.y + 18} Q ${start.x} ${start.y + 5} ${(start.x + end.x) / 2} ${start.y + 5} Q ${end.x} ${start.y + 5} ${end.x} ${start.y + 18}`
          : `M ${start.x - 18} ${start.y} Q ${start.x - 5} ${start.y} ${start.x - 5} ${(start.y + end.y) / 2} Q ${start.x - 5} ${end.y} ${start.x - 18} ${end.y}`;
        const labelX = horizontal ? (start.x + end.x) / 2 - 100 : start.x - 128;
        const labelY = horizontal ? start.y + 22 : (start.y + end.y) / 2 - 18;
        return (
          <g key={`${scene.id}-${action.t}-brace`} opacity={Math.max(0.2, reveal)}>
            <path d={path} fill="none" stroke={chalkColors.yellow} strokeWidth={3} />
            <foreignObject x={labelX} y={labelY} width={200} height={38}>
              {renderStageLabel(action.label ?? "")}
            </foreignObject>
          </g>
        );
      }
      case "textBlock": {
        const position = normalizePoint(action.position) ?? {
          x: safeNumber(action.x, 0),
          y: safeNumber(action.y, 0),
        };
        const screen = toScreen(position.x, position.y, view, width, height);
        return (
          <foreignObject
            key={`${scene.id}-${action.t}-textBlock`}
            x={screen.x}
            y={screen.y}
            width={safeNumber(action.width, 360)}
            height={safeNumber(action.height, 180)}
            opacity={Math.max(0.15, reveal)}
          >
            <div
              style={{
                color: chalkColors.white,
                background: "rgba(15,23,42,0.8)",
                border: "1px solid rgba(148,163,184,0.5)",
                borderRadius: 12,
                padding: 14,
                fontSize: 18 / stageScale,
                lineHeight: 1.4,
              }}
            >
              {typeof action.text === "string" ? (
                <div dangerouslySetInnerHTML={{ __html: renderMathLabel(action.text) }} />
              ) : null}
              {typeof action.latex === "string" ? (
                <div
                  style={{ marginTop: 10 }}
                  dangerouslySetInnerHTML={{ __html: renderMath(action.latex) }}
                />
              ) : null}
            </div>
          </foreignObject>
        );
      }
      case "flowNode": {
        const center = normalizePoint(action.position) ?? {
          x: safeNumber(action.x, 0),
          y: safeNumber(action.y, 0),
        };
        const nodeWidth = safeNumber(action.width, 2.2);
        const nodeHeight = safeNumber(action.height, 1.2);
        const topLeft = toScreen(
          center.x - nodeWidth / 2,
          center.y + nodeHeight / 2,
          view,
          width,
          height,
        );
        const bottomRight = toScreen(
          center.x + nodeWidth / 2,
          center.y - nodeHeight / 2,
          view,
          width,
          height,
        );
        return (
          <g key={`${scene.id}-${action.t}-flowNode`} opacity={Math.max(0.15, reveal)}>
            <rect
              x={topLeft.x}
              y={topLeft.y}
              width={bottomRight.x - topLeft.x}
              height={bottomRight.y - topLeft.y}
              rx={12}
              fill="rgba(15,23,42,0.86)"
              stroke={chalkColors.blue}
              strokeWidth={3}
            />
            <foreignObject
              x={topLeft.x + 8}
              y={topLeft.y + 8}
              width={bottomRight.x - topLeft.x - 16}
              height={bottomRight.y - topLeft.y - 16}
            >
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: chalkColors.white,
                  fontSize: 19 / stageScale,
                }}
                dangerouslySetInnerHTML={{
                  __html: renderMathLabel(action.label ?? action.text ?? action.id ?? "Step"),
                }}
              />
            </foreignObject>
          </g>
        );
      }
      case "flowArrow": {
        const from = normalizePoint(action.from);
        const to = normalizePoint(action.to);
        if (!from || !to) return null;
        const start = toScreen(from.x, from.y, view, width, height);
        const end = toScreen(to.x, to.y, view, width, height);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLength = 15;
        const left = {
          x: end.x - headLength * Math.cos(angle - Math.PI / 6),
          y: end.y - headLength * Math.sin(angle - Math.PI / 6),
        };
        const right = {
          x: end.x - headLength * Math.cos(angle + Math.PI / 6),
          y: end.y - headLength * Math.sin(angle + Math.PI / 6),
        };
        return (
          <g key={`${scene.id}-${action.t}-flowArrow`} opacity={Math.max(0.15, reveal)}>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={chalkColors.yellow}
              strokeWidth={3}
            />
            <polygon
              points={`${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`}
              fill={chalkColors.yellow}
            />
            {action.label ? (
              <foreignObject
                x={(start.x + end.x) / 2 - 70}
                y={(start.y + end.y) / 2 - 30}
                width={140}
                height={32}
              >
                {renderStageLabel(action.label, 16)}
              </foreignObject>
            ) : null}
          </g>
        );
      }
      case "timeline": {
        const events = Array.isArray(action.events)
          ? (action.events.filter((event) => typeof event === "object" && event !== null) as Record<
              string,
              unknown
            >[])
          : [];
        if (events.length === 0) return null;
        const left = 96;
        const right = width - 96;
        const baseline = height * 0.62;
        return (
          <g key={`${scene.id}-${action.t}-timeline`} opacity={Math.max(0.15, reveal)}>
            <line
              x1={left}
              y1={baseline}
              x2={right}
              y2={baseline}
              stroke={chalkColors.blue}
              strokeWidth={4}
            />
            {events.map((event, index) => {
              const progress = events.length === 1 ? 0.5 : index / (events.length - 1);
              const x = left + (right - left) * progress;
              return (
                <g key={index}>
                  <circle cx={x} cy={baseline} r={9} fill={chalkColors.yellow} />
                  <line
                    x1={x}
                    y1={baseline - 8}
                    x2={x}
                    y2={baseline - (index % 2 === 0 ? 72 : 42)}
                    stroke={chalkColors.yellow}
                    strokeWidth={2}
                  />
                  <foreignObject
                    x={x - 95}
                    y={baseline - (index % 2 === 0 ? 142 : 112)}
                    width={190}
                    height={64}
                  >
                    {renderStageLabel(event.label ?? "Event", 16)}
                  </foreignObject>
                  <foreignObject x={x - 86} y={baseline + 17} width={172} height={38}>
                    {renderStageLabel(event.when ?? index + 1, 16)}
                  </foreignObject>
                </g>
              );
            })}
          </g>
        );
      }
      case "drawAxes": {
        return null;
      }
      case "plotFunction": {
        const expr = typeof action.expr === "string" ? action.expr : "x^2";
        const stroke =
          typeof action.color === "string"
            ? (chalkColors[action.color] ?? chalkColors.blue)
            : chalkColors.blue;
        const d = staticActionPaths.get(action) ?? "";
        const strokeWidth = safeNumber(action.strokeWidth, 4);
        return (
          <path
            key={`${scene.id}-${action.t}-plotFunction`}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: reducedMotion ? undefined : "2000",
              strokeDashoffset: reducedMotion ? "0" : `${2000 * (1 - reveal)}`,
              filter: "drop-shadow(0 0 12px rgba(124, 201, 255, 0.4))",
            }}
            opacity={Math.max(0.25, reveal)}
          />
        );
      }
      case "plotPoints": {
        const rawPoints = Array.isArray(action.points) ? action.points : [];
        const color =
          typeof action.color === "string"
            ? (chalkColors[action.color] ?? chalkColors.blue)
            : chalkColors.blue;
        return (
          <g key={`${scene.id}-${action.t}-plotPoints`}>
            {rawPoints.map((point, index) => {
              const normalized = normalizePoint(point);
              if (!normalized) return null;
              const screen = toScreen(normalized.x, normalized.y, view, width, height);
              const scale = 0.35 + reveal * 0.8;
              return (
                <circle
                  key={`${index}-${point}`}
                  cx={screen.x}
                  cy={screen.y}
                  r={safeNumber(action.radius, 5) * scale}
                  fill={color}
                  opacity={Math.max(0.2, reveal)}
                />
              );
            })}
          </g>
        );
      }
      case "movePoint": {
        const expr = typeof action.expr === "string" ? action.expr : "x^2";
        const startX = safeNumber(action.x, -2);
        const endX = safeNumber(action.toX ?? action.x ?? startX, startX);
        const animatedX = startX + (endX - startX) * reveal;
        const y = evaluateExpr(expr, animatedX);
        const screen = toScreen(animatedX, y, view, width, height);
        const color =
          typeof action.color === "string"
            ? (chalkColors[action.color] ?? chalkColors.red)
            : chalkColors.red;
        const radius = safeNumber(action.radius, 7);
        const trail = action.trail === true;
        const segments = trail
          ? Array.from({ length: 14 }, (_, idx) => {
              const ratio = clamp(reveal * 1.05 - idx / 14, 0, 1);
              const sampleX = startX + (endX - startX) * ratio;
              const sampleY = evaluateExpr(expr, sampleX);
              const sampleScreen = toScreen(sampleX, sampleY, view, width, height);
              return { ...sampleScreen, ratio };
            })
          : [];

        return (
          <g key={`${scene.id}-${action.t}-movePoint`}>
            {trail &&
              segments.map((segment, idx) => (
                <circle
                  key={`trail-${idx}`}
                  cx={segment.x}
                  cy={segment.y}
                  r={Math.max(2, radius * (0.2 + segment.ratio * 0.7))}
                  fill={color}
                  opacity={0.15 + segment.ratio * 0.5}
                />
              ))}
            <circle
              cx={screen.x}
              cy={screen.y}
              r={radius}
              fill={color}
              opacity={Math.max(0.5, reveal)}
            />
            {action.label ? (
              <text
                x={screen.x + 18}
                y={screen.y - 16}
                fill={color}
                fontSize={18 / stageScale}
                fontWeight={700}
              >
                {String(action.label)}
              </text>
            ) : null}
          </g>
        );
      }
      case "showLabel": {
        const label = typeof action.text === "string" ? action.text : "";
        const x = safeNumber(action.x, 0);
        const y = safeNumber(action.y, 0);
        const color =
          typeof action.color === "string"
            ? (chalkColors[action.color] ?? chalkColors.white)
            : chalkColors.white;
        const screen = toScreen(x, y, view, width, height);
        return (
          <text
            key={`${scene.id}-${action.t}-showLabel`}
            x={screen.x}
            y={screen.y}
            fill={color}
            fontSize={20 / stageScale}
            fontWeight={700}
            opacity={Math.max(0.25, reveal)}
          >
            {label}
          </text>
        );
      }
      case "drawLine":
      case "drawSegment":
      case "drawVector": {
        const from = normalizePoint(action.from ?? action.start ?? [0, 0]);
        const to = normalizePoint(action.to ?? action.end ?? [0, 0]);
        if (!from || !to) return null;
        const start = toScreen(from.x, from.y, view, width, height);
        const end = toScreen(to.x, to.y, view, width, height);
        const color =
          typeof action.color === "string"
            ? (chalkColors[action.color] ?? chalkColors.white)
            : chalkColors.white;
        const dashed = Boolean(action.dashed);
        return (
          <g key={`${scene.id}-${action.t}-${action.do}`} opacity={Math.max(0.1, reveal)}>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={color}
              strokeWidth={safeNumber(action.strokeWidth, 3)}
              strokeDasharray={dashed ? "12 10" : undefined}
            />
            {action.do === "drawVector" ? (
              <polygon
                points={`${end.x},${end.y} ${end.x - 12},${end.y - 5} ${end.x - 12},${end.y + 5}`}
                fill={color}
                transform={`rotate(${Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI)} ${end.x} ${end.y})`}
              />
            ) : null}
          </g>
        );
      }
      case "tangentLine": {
        const expr = typeof action.expr === "string" ? action.expr : "x^2";
        const xValue = safeNumber(action.x, 0);
        const slope = derivativeAt(expr, xValue);
        const yValue = evaluateExpr(expr, xValue);
        const start = toScreen(xMin, slope * xMin - slope * xValue + yValue, view, width, height);
        const end = toScreen(xMax, slope * xMax - slope * xValue + yValue, view, width, height);
        const color =
          typeof action.color === "string"
            ? (chalkColors[action.color] ?? chalkColors.yellow)
            : chalkColors.yellow;
        return (
          <line
            key={`${scene.id}-${action.t}-tangentLine`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={color}
            strokeWidth={safeNumber(action.strokeWidth, 3)}
            strokeDasharray={"16 12"}
            opacity={Math.max(0.15, reveal)}
          />
        );
      }
      case "shadeArea": {
        const expr = typeof action.expr === "string" ? action.expr : "x^2";
        const color =
          typeof action.color === "string"
            ? (chalkColors[action.color] ?? chalkColors.green)
            : chalkColors.green;
        const d = staticActionPaths.get(action) ?? "";
        return (
          <path
            key={`${scene.id}-${action.t}-shadeArea`}
            d={d}
            fill={color}
            opacity={0.12 + reveal * 0.4}
          />
        );
      }
      case "drawShape": {
        const shape = String(action.shape ?? action.kind ?? "rectangle");
        const color =
          typeof action.color === "string"
            ? (chalkColors[action.color] ?? chalkColors.green)
            : chalkColors.green;
        const x = safeNumber(action.x, 0);
        const y = safeNumber(action.y, 0);
        const size = safeNumber(action.size ?? action.width ?? 1, 1);
        const screen = toScreen(x, y, view, width, height);
        const drawWidth = size * 48;
        const drawHeight = size * 48;

        if (shape === "circle") {
          return (
            <circle
              key={`${scene.id}-${action.t}-circle`}
              cx={screen.x}
              cy={screen.y}
              r={Math.max(8, drawWidth / 2)}
              fill="none"
              stroke={color}
              strokeWidth={3}
              opacity={Math.max(0.2, reveal)}
            />
          );
        }
        if (shape === "triangle") {
          const p1 = { x: screen.x, y: screen.y - drawHeight / 2 };
          const p2 = { x: screen.x - drawWidth / 2, y: screen.y + drawHeight / 2 };
          const p3 = { x: screen.x + drawWidth / 2, y: screen.y + drawHeight / 2 };
          return (
            <polygon
              key={`${scene.id}-${action.t}-triangle`}
              points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
              fill="none"
              stroke={color}
              strokeWidth={3}
              opacity={Math.max(0.2, reveal)}
            />
          );
        }
        return (
          <rect
            key={`${scene.id}-${action.t}-rect`}
            x={screen.x - drawWidth / 2}
            y={screen.y - drawHeight / 2}
            width={drawWidth}
            height={drawHeight}
            fill="none"
            stroke={color}
            strokeWidth={3}
            opacity={Math.max(0.2, reveal)}
            rx={8}
          />
        );
      }
      case "equationStep": {
        const latex = typeof action.latex === "string" ? action.latex : "";
        if (!latex) return null;
        const color =
          typeof action.color === "string"
            ? (chalkColors[action.color] ?? chalkColors.white)
            : chalkColors.white;
        const screen = toScreen(
          safeNumber(action.x, 2.2),
          safeNumber(action.y, 8.5),
          view,
          width,
          height,
        );
        return (
          <foreignObject
            key={`${scene.id}-${action.t}-equationStep`}
            x={screen.x}
            y={screen.y - 28}
            width={220}
            height={80}
            opacity={Math.max(0.15, reveal)}
          >
            <div
              style={{
                color,
                fontSize: "30px",
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                fontWeight: 600,
              }}
              dangerouslySetInnerHTML={{ __html: renderMath(latex) }}
            />
          </foreignObject>
        );
      }
      case "highlight": {
        const x = safeNumber(action.x, 0);
        const y = safeNumber(action.y, 0);
        const radius = safeNumber(action.radius, 26);
        const screen = toScreen(x, y, view, width, height);
        const color =
          typeof action.color === "string"
            ? (chalkColors[action.color] ?? chalkColors.yellow)
            : chalkColors.yellow;
        return (
          <circle
            key={`${scene.id}-${action.t}-highlight`}
            cx={screen.x}
            cy={screen.y}
            r={radius * (0.3 + reveal)}
            fill={color}
            opacity={0.12 + reveal * 0.25}
          />
        );
      }
      case "fade": {
        const targetOpacity = safeNumber(action.opacity, 1);
        return (
          <g key={`${scene.id}-${action.t}-fade`} opacity={Math.max(0.05, reveal * targetOpacity)}>
            <circle
              cx={width / 2}
              cy={height / 2}
              r={Math.min(width, height) * 0.3}
              fill="#101827"
            />
          </g>
        );
      }
      default: {
        return null;
      }
    }
  };

  return (
    <div
      ref={stageRef}
      className="lesson-stage relative aspect-[4/3] w-full touch-pan-y overflow-hidden bg-[#102232] text-slate-50 sm:aspect-[16/10]"
      style={
        { "--lesson-animation-state": isVisible ? "running" : "paused" } as React.CSSProperties
      }
      role="img"
      aria-label={`${scene.caption}. ${scene.narration}`}
      onClick={onStageClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute left-3 top-3 z-20 rounded-md bg-slate-950/70 px-2 py-1 text-xs text-slate-300">
        {scene.caption}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        style={
          { "--lesson-animation-state": isVisible ? "running" : "paused" } as React.CSSProperties
        }
      >
        <defs>
          <filter id="lesson-active-glow" x="-35%" y="-35%" width="170%" height="170%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="outline" />
            <feFlood floodColor="#fff4c2" floodOpacity="0.9" result="outline-color" />
            <feComposite in="outline-color" in2="outline" operator="in" result="outline-shape" />
            <feGaussianBlur in="outline-shape" stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="outline-shape" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g>
          {gridLines}
          {axisNodes}
          {renderActions.map((action, index) => (
            <g
              key={`emphasis-${scene.id}-${index}`}
              className="lesson-action-focus"
              style={{
                opacity: activeActionIndex < 0 || activeActionIndex === index ? 1 : 0.6,
                filter: activeActionIndex === index ? "url(#lesson-active-glow)" : undefined,
              }}
            >
              {renderAction(action)}
            </g>
          ))}
        </g>
      </svg>
      {typeof scene.why === "string" &&
      scene.why.trim() &&
      !scene.actions.some((action) => action.do === "cycleWheel") ? (
        <div className="lesson-visual-why">{scene.why}</div>
      ) : null}
    </div>
  );
}

const MemoizedLessonBoard = memo(LessonBoard);

function LessonPlayerView({
  lesson,
  suggestedTopics = [],
  onAskFollowUp,
  onSuggestedTopic,
  stepFollowUps = {},
  onExplainStep,
}: {
  lesson: Lesson;
  suggestedTopics?: string[];
  onAskFollowUp?: () => void;
  onSuggestedTopic?: (topic: string) => void;
  stepFollowUps?: Record<
    string,
    Partial<Record<LessonStepExplanationMode, LessonStepExplanationState>>
  >;
  onExplainStep?: (stepId: string, mode: LessonStepExplanationMode) => void;
}) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showHint, setShowHint] = useState(false);
  const [checkStage, setCheckStage] = useState<
    "ready" | "remediation" | "retry" | "retryOriginal" | "correct"
  >("ready");
  const [checkAnswer, setCheckAnswer] = useState("");
  const [checkFeedback, setCheckFeedback] = useState<string | null>(null);
  const understandingAnswerId = useId();
  const solutionHeadingId = useId();
  const [expandedGuidanceScene, setExpandedGuidanceScene] = useState<number | null>(null);
  const [restoredSceneKey, setRestoredSceneKey] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const sceneStorageKey = `lesson-scene:${lesson.title}:${lesson.scenes.map((item) => item.id).join(",")}`;
  const updateElapsed = useCallback((nextElapsed: number) => {
    elapsedRef.current = nextElapsed;
    setElapsed(nextElapsed);
  }, []);

  const scene = lesson.scenes[sceneIndex] ?? lesson.scenes[lesson.scenes.length - 1];
  const renderElapsed = reducedMotion ? (scene?.duration ?? 0) : elapsed;

  const completed =
    sceneIndex >= lesson.scenes.length - 1 && renderElapsed >= (scene?.duration ?? 0);

  useEffect(() => {
    try {
      const savedSceneValue = window.sessionStorage.getItem(sceneStorageKey);
      if (savedSceneValue !== null) {
        const savedScene = Number(savedSceneValue);
        if (Number.isInteger(savedScene) && savedScene >= 0 && savedScene < lesson.scenes.length) {
          setSceneIndex(savedScene);
          updateElapsed(0);
          setIsPlaying(false);
        }
      }
    } catch (error) {
      console.warn("Unable to restore the lesson scene from session storage.", error);
    }
    setRestoredSceneKey(sceneStorageKey);
  }, [lesson.scenes.length, sceneStorageKey, updateElapsed]);

  useEffect(() => {
    if (restoredSceneKey !== sceneStorageKey) return;
    try {
      window.sessionStorage.setItem(sceneStorageKey, String(sceneIndex));
    } catch (error) {
      console.warn("Unable to remember the current lesson scene.", error);
    }
  }, [restoredSceneKey, sceneIndex, sceneStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    const player = playerRef.current;
    if (!player) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      threshold: 0.05,
    });
    observer.observe(player);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      updateElapsed(scene?.duration ?? 0);
      setIsPlaying(false);
    }
  }, [reducedMotion, scene?.duration, sceneIndex, updateElapsed]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setIsFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  useEffect(() => {
    if (!isPlaying || !isVisible || reducedMotion) return;

    let frameId = 0;
    let lastTimestamp = performance.now();

    const tick = (timestamp: number) => {
      const delta = ((timestamp - lastTimestamp) / 1000) * speed;
      lastTimestamp = timestamp;

      const currentScene = lesson.scenes[sceneIndex];
      if (!currentScene) return;

      const nextElapsed = elapsedRef.current + delta;
      if (nextElapsed >= currentScene.duration) {
        if (sceneIndex >= lesson.scenes.length - 1) {
          updateElapsed(currentScene.duration);
          setIsPlaying(false);
        } else {
          updateElapsed(0);
          setSceneIndex((index) => Math.min(index + 1, lesson.scenes.length - 1));
        }
      } else {
        updateElapsed(nextElapsed);
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, isVisible, reducedMotion, lesson.scenes, sceneIndex, speed, updateElapsed]);

  useEffect(() => {
    const narration = scene?.narration;
    if (
      !narration ||
      !isVisible ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    const speech = new SpeechSynthesisUtterance(narration);
    speech.rate = 1;
    speech.pitch = 1;
    speech.volume = 1;
    window.speechSynthesis.cancel();
    if (isPlaying && !reducedMotion) {
      window.speechSynthesis.speak(speech);
    }
    return () => window.speechSynthesis.cancel();
  }, [scene?.narration, isPlaying, isVisible, reducedMotion]);

  const goToScene = useCallback(
    (nextIndex: number) => {
      const clamped = clamp(nextIndex, 0, lesson.scenes.length - 1);
      setSceneIndex(clamped);
      updateElapsed(0);
      setIsPlaying(false);
    },
    [lesson.scenes.length, updateElapsed],
  );

  const checkUnderstanding = useCallback(() => {
    const remediation = lesson.challenge.remediation;
    const expectedAnswer =
      checkStage === "remediation" ? remediation?.simplerAnswer : lesson.challenge.answer;
    if (!expectedAnswer || !isCorrectUnderstandingAnswer(checkAnswer, expectedAnswer)) {
      setCheckAnswer("");
      setShowHint(false);
      if (checkStage === "remediation") {
        setCheckFeedback("Not quite. Use the hint, then try this smaller example again.");
        return;
      }

      const feedback =
        remediation?.likelyMisconception ??
        "The key idea may be getting mixed up. Review how the last step changes the result.";
      setCheckFeedback(feedback);
      if (remediation) {
        const sceneIndex = lesson.scenes.findIndex((item) =>
          item.stepRefs.includes(remediation.stepRef),
        );
        if (sceneIndex >= 0) goToScene(sceneIndex);
        setCheckStage("remediation");
      } else {
        const lastScene = lesson.scenes.length - 1;
        goToScene(lastScene);
        setCheckStage("retry");
      }
      return;
    }

    setCheckAnswer("");
    setShowHint(false);
    if (checkStage === "remediation") {
      setCheckFeedback(
        `That's right. ${remediation?.explanation} Now try the original check again.`,
      );
      setCheckStage("retry");
      return;
    }
    setCheckFeedback(`Correct. ${lesson.challenge.explanation ?? lesson.takeaway}`);
    setCheckStage("correct");
  }, [checkAnswer, checkStage, goToScene, lesson]);

  const togglePlayback = useCallback(() => {
    if (completed && !isPlaying) {
      setSceneIndex(0);
      updateElapsed(reducedMotion ? (lesson.scenes[0]?.duration ?? 0) : 0);
      setIsPlaying(!reducedMotion);
      return;
    }
    setIsPlaying((value) => !value);
  }, [completed, isPlaying, lesson.scenes, reducedMotion, updateElapsed]);

  const restartScene = useCallback(() => {
    updateElapsed(0);
    setIsPlaying(false);
  }, [updateElapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (event.key === "Escape") {
        if (document.fullscreenElement === playerRef.current) void document.exitFullscreen();
        return;
      }
      if (target.isContentEditable || target.matches("input, textarea, select, [role='slider']"))
        return;
      if (event.code === "Space" && target.matches("button, a, summary")) return;

      const isStage = target.closest(".lesson-stage");
      if (
        (event.code === "Space" || event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        isStage
      ) {
        return;
      }

      switch (event.key) {
        case " ":
          event.preventDefault();
          togglePlayback();
          break;
        case "ArrowLeft":
          event.preventDefault();
          goToScene(sceneIndex - 1);
          break;
        case "ArrowRight":
          event.preventDefault();
          goToScene(sceneIndex + 1);
          break;
        case "r":
        case "R":
          event.preventDefault();
          restartScene();
          break;
        case "Home":
          event.preventDefault();
          goToScene(0);
          break;
        case "End":
          event.preventDefault();
          goToScene(lesson.scenes.length - 1);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToScene, lesson.scenes.length, restartScene, sceneIndex, togglePlayback]);

  const toggleFullscreen = async () => {
    const player = playerRef.current;
    if (!player || typeof document === "undefined") return;
    try {
      if (document.fullscreenElement === player) await document.exitFullscreen();
      else await player.requestFullscreen();
    } catch {
      setIsFullscreen(false);
    }
  };

  const onTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStart.current;
      const touch = event.changedTouches[0];
      touchStart.current = null;
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 400);
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
        goToScene(sceneIndex + (dx < 0 ? 1 : -1));
      } else if (Math.abs(dx) < 16 && Math.abs(dy) < 16) {
        togglePlayback();
      }
    },
    [goToScene, sceneIndex, togglePlayback],
  );

  const onStageClick = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    togglePlayback();
  }, [togglePlayback]);

  const playPauseLabel = isPlaying ? "Pause" : "Play";
  const progressPercent =
    lesson.scenes.length > 1 ? (sceneIndex / (lesson.scenes.length - 1)) * 100 : 0;
  const guidance = [
    { label: "Doing", text: scene.doing, extra: false },
    { label: "Why", text: scene.why, extra: true },
    { label: "Changed", text: scene.changed, extra: true },
    { label: "Remember", text: scene.remember, extra: false },
  ];
  const guidedRows = guidance.filter(
    (row): row is { label: string; text: string; extra: boolean } =>
      typeof row.text === "string" && Boolean(row.text.trim()),
  );
  const hasExtraGuidance = guidedRows.some((row) => row.extra);
  const showGuidedDetails = expandedGuidanceScene === sceneIndex;
  const nextTopics = suggestedTopics.filter((topic) => topic.trim()).slice(0, 2);
  const referencedSteps = scene.stepRefs
    .map((stepId) => lesson.solution.steps.find((step) => step.id === stepId))
    .filter((step): step is Lesson["solution"]["steps"][number] => step !== undefined);

  return (
    <section
      ref={playerRef}
      aria-label="Lesson player"
      className={`lesson-player min-w-0${isFullscreen ? " lesson-player-fullscreen" : ""}`}
    >
      <header className="lesson-header flex min-w-0 items-center justify-between gap-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)]">
            Lesson
          </div>
          <h2 className="mt-1 truncate text-xl font-bold text-[var(--color-text)] sm:text-2xl">
            {lesson.title}
          </h2>
        </div>
        <button
          type="button"
          aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
          title={isFullscreen ? "Exit full screen" : "Full screen"}
          onClick={toggleFullscreen}
          className="lesson-fullscreen-button"
        >
          <Maximize aria-hidden="true" size={20} />
        </button>
      </header>

      <div className="lesson-layout">
        <section className="lesson-stage-region min-w-0">
          <section className="lesson-grounding" aria-label="Question grounding">
            <div className="lesson-grounding-question">
              <span>Question grounding</span>
              <h3>Your question</h3>
              <p>{lesson.solution.question}</p>
            </div>
            <div className="lesson-grounding-facts">
              <div>
                <h4>What we know</h4>
                {lesson.solution.given.length > 0 ? (
                  <ul>
                    {lesson.solution.given.map((item, index) => (
                      <li key={`${index}-${item}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No specific values or conditions were provided.</p>
                )}
              </div>
              <div>
                <h4>What we need to find</h4>
                <p>{lesson.solution.find}</p>
              </div>
              <div>
                <h4>Method</h4>
                <p>{lesson.solution.method}</p>
              </div>
              {lesson.solution.variables.length > 0 ? (
                <div>
                  <h4>Variables</h4>
                  <ul>
                    {lesson.solution.variables.map((variable) => (
                      <li key={variable.symbol}>
                        <strong>{variable.symbol}</strong>: {variable.definition}
                        {variable.units ? ` (${variable.units})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
          <MemoizedLessonBoard
            scene={scene}
            previousScene={lesson.scenes[sceneIndex - 1]}
            elapsed={renderElapsed}
            reducedMotion={reducedMotion}
            isVisible={isVisible}
            onStageClick={onStageClick}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          />

          <div className="lesson-mobile-narration" aria-live="polite" aria-atomic="true">
            <p>{scene.narration}</p>
          </div>

          {guidedRows.length > 0 ? (
            <section
              className={`lesson-guided-block${showGuidedDetails ? " is-expanded" : ""}`}
              aria-label="Guided step"
            >
              {guidedRows
                .filter((row) => !row.extra)
                .map(({ label, text }) => (
                  <div key={`${scene.id}-${label}`} className="lesson-guided-row">
                    <span>{label}</span>
                    <p>{text}</p>
                  </div>
                ))}
              {hasExtraGuidance ? (
                <>
                  <div id={`lesson-guided-details-${scene.id}`} className="lesson-guided-extra">
                    {guidedRows
                      .filter((row) => row.extra)
                      .map(({ label, text }) => (
                        <div key={`${scene.id}-${label}`} className="lesson-guided-row">
                          <span>{label}</span>
                          <p>{text}</p>
                        </div>
                      ))}
                  </div>
                  <button
                    type="button"
                    className="lesson-guided-toggle"
                    aria-expanded={showGuidedDetails}
                    aria-controls={`lesson-guided-details-${scene.id}`}
                    onClick={() => setExpandedGuidanceScene(showGuidedDetails ? null : sceneIndex)}
                  >
                    {showGuidedDetails ? "Show less" : "Explain more"}
                  </button>
                </>
              ) : null}
            </section>
          ) : null}

          {referencedSteps.length > 0 ? (
            <section className="lesson-step-trace" aria-label="Question-to-step trace">
              <h3>This step answers</h3>
              {referencedSteps.map((step) => (
                <div key={step.id} className="lesson-step-trace-item">
                  <span>{step.id.replace(/^step-/, "Step ")}</span>
                  <p>{step.reasoning}</p>
                  {onExplainStep ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(
                        [
                          ["why", "Why?"],
                          ["simpler", "Explain more simply"],
                        ] as const
                      ).map(([mode, label]) => {
                        const followUp = stepFollowUps[step.id]?.[mode];
                        return (
                          <button
                            key={mode}
                            type="button"
                            className="ds-btn ds-btn--ghost"
                            disabled={followUp?.loading}
                            onClick={() => onExplainStep(step.id, mode)}
                          >
                            {followUp?.loading ? "Thinking…" : label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {(["why", "simpler"] as const).map((mode) => {
                    const followUp = stepFollowUps[step.id]?.[mode];
                    if (!followUp) return null;
                    if (followUp.loading) {
                      return (
                        <p key={mode} className="mt-2 text-sm text-muted-foreground" role="status">
                          Preparing a focused explanation…
                        </p>
                      );
                    }
                    if (followUp.error) {
                      return (
                        <p key={mode} className="mt-2 text-sm text-destructive" role="alert">
                          {followUp.error}
                        </p>
                      );
                    }
                    if (followUp.explanation) {
                      return (
                        <div
                          key={mode}
                          className="mt-3 rounded-lg border border-sky-200/20 bg-sky-100/5 p-3 text-sm"
                          aria-label={
                            mode === "why" ? "Why this step works" : "Simpler explanation"
                          }
                        >
                          <Suspense
                            fallback={<p className="whitespace-pre-wrap">{followUp.explanation}</p>}
                          >
                            <StepExplanationMarkdown content={followUp.explanation} />
                          </Suspense>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ))}
              {scene.visualPurpose ? (
                <p className="lesson-visual-purpose">
                  <strong>Why this visual:</strong> {scene.visualPurpose}
                </p>
              ) : null}
            </section>
          ) : null}

          <nav className="lesson-controls" aria-label="Lesson controls">
            <div className="lesson-progress-header">
              <div className="lesson-progress-copy">
                {scene.section?.trim() ? (
                  <span className="lesson-section-name">{scene.section}</span>
                ) : null}
                <span className="lesson-scene-count">
                  Step {sceneIndex + 1} of {lesson.scenes.length}
                </span>
              </div>
              <input
                className="lesson-progress-slider"
                type="range"
                min={0}
                max={Math.max(lesson.scenes.length - 1, 1)}
                step={1}
                value={sceneIndex}
                aria-label="Jump to lesson step"
                aria-valuetext={`${scene.section?.trim() ? `${scene.section}, ` : ""}Step ${sceneIndex + 1} of ${lesson.scenes.length}`}
                onChange={(event) => goToScene(Number(event.target.value))}
                style={{ "--progress": `${progressPercent}%` } as React.CSSProperties}
              />
              <span
                className="sr-only"
                role="progressbar"
                aria-label="Lesson progress"
                aria-valuemin={1}
                aria-valuemax={lesson.scenes.length}
                aria-valuenow={sceneIndex + 1}
                aria-valuetext={`Step ${sceneIndex + 1} of ${lesson.scenes.length}${scene.section?.trim() ? `, ${scene.section}` : ""}`}
              />
            </div>
            <div className="lesson-control-actions">
              <button
                type="button"
                aria-label="Previous scene"
                data-shortcut="←"
                onClick={() => goToScene(sceneIndex - 1)}
                disabled={sceneIndex === 0}
              >
                <ChevronLeft aria-hidden="true" size={22} />
              </button>
              <button
                type="button"
                aria-label={isPlaying ? "Pause lesson" : "Play lesson"}
                data-shortcut="Space"
                aria-pressed={isPlaying}
                onClick={togglePlayback}
                className="lesson-play-button"
              >
                {isPlaying ? (
                  <Pause aria-hidden="true" size={20} />
                ) : (
                  <Play aria-hidden="true" size={20} />
                )}
              </button>
              <button
                type="button"
                aria-label="Next scene"
                data-shortcut="→"
                onClick={() => goToScene(sceneIndex + 1)}
                disabled={sceneIndex >= lesson.scenes.length - 1}
              >
                <ChevronRight aria-hidden="true" size={22} />
              </button>
              <button
                type="button"
                aria-label="Restart current scene"
                data-shortcut="R"
                onClick={restartScene}
              >
                <RotateCcw aria-hidden="true" size={20} />
              </button>
              <div className="lesson-desktop-speed" aria-label="Playback speed">
                {[0.5, 1, 1.5, 2].map((speedValue) => (
                  <button
                    key={speedValue}
                    type="button"
                    aria-label={`Playback speed ${speedValue} times`}
                    aria-pressed={speed === speedValue}
                    onClick={() => setSpeed(speedValue)}
                  >
                    {speedValue}x
                  </button>
                ))}
              </div>
              <details className="lesson-mobile-overflow">
                <summary aria-label="Playback speed" title="Playback speed">
                  <MoreHorizontal aria-hidden="true" size={22} />
                </summary>
                <div className="lesson-mobile-speed">
                  {[0.5, 1, 1.5, 2].map((speedValue) => (
                    <button
                      key={speedValue}
                      type="button"
                      aria-label={`Playback speed ${speedValue} times`}
                      aria-pressed={speed === speedValue}
                      onClick={() => setSpeed(speedValue)}
                    >
                      {speedValue}x
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </nav>
        </section>

        <aside className="lesson-details min-w-0">
          <section className="lesson-solution" aria-labelledby={solutionHeadingId}>
            <h3 id={solutionHeadingId}>What we’re learning</h3>
            <p className="lesson-solution-answer">{lesson.solution.find}</p>
            {lesson.solution.given.length > 0 ? (
              <div className="lesson-solution-values">
                <strong>What we know</strong>
                <ul>
                  {lesson.solution.given.map((given, index) => (
                    <li key={`${index}-${given}`}>{given}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {lesson.solution.calculations.some((calculation) =>
              referencedSteps.some((step) => step.calculationRefs.includes(calculation.id)),
            ) ? (
              <ol className="lesson-solution-calculations" aria-label="Checked calculations">
                {lesson.solution.calculations
                  .filter((calculation) =>
                    referencedSteps.some((step) => step.calculationRefs.includes(calculation.id)),
                  )
                  .map((calculation) => (
                    <li key={calculation.id}>
                      <code>
                        {calculation.expression} = {calculation.result}
                      </code>
                      {calculation.units ? ` ${calculation.units}` : ""}
                    </li>
                  ))}
              </ol>
            ) : null}
            <ol>
              {referencedSteps.map((step) => (
                <li key={step.id}>{step.reasoning}</li>
              ))}
            </ol>
          </section>
          <div className="lesson-desktop-narration" aria-live="polite" aria-atomic="true">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Narration
            </div>
            <p className="mt-2 text-base leading-relaxed">{scene.narration}</p>
          </div>

          {scene.equation?.latex ? (
            <details className="lesson-equation">
              <summary>Equation</summary>
              <div
                className="lesson-equation-content"
                dangerouslySetInnerHTML={{
                  __html: renderMath(scene.equation.latex, { displayMode: false }),
                }}
              />
            </details>
          ) : null}

          {completed || checkStage !== "ready" ? (
            <section className="lesson-challenge" aria-live="polite">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Check your understanding
              </div>
              <p className="mt-2">
                {checkStage === "remediation"
                  ? lesson.challenge.remediation?.simplerQuestion
                  : lesson.challenge.question}
              </p>
              {checkFeedback ? (
                <p className="lesson-challenge-detail" role="status">
                  {checkFeedback}
                </p>
              ) : null}
              {checkStage === "correct" ? (
                <p className="lesson-challenge-detail">Answer: {lesson.challenge.answer}</p>
              ) : checkStage === "retry" ? (
                <button
                  type="button"
                  className="ds-btn ds-btn--primary mt-3"
                  onClick={() => {
                    setCheckAnswer("");
                    setCheckFeedback(null);
                    setShowHint(false);
                    setCheckStage("retryOriginal");
                  }}
                >
                  Try the original check again
                </button>
              ) : (
                <form
                  className="lesson-challenge-actions"
                  onSubmit={(event) => {
                    event.preventDefault();
                    checkUnderstanding();
                  }}
                >
                  <label className="sr-only" htmlFor={understandingAnswerId}>
                    Your answer
                  </label>
                  <input
                    id={understandingAnswerId}
                    value={checkAnswer}
                    onChange={(event) => setCheckAnswer(event.target.value)}
                    autoComplete="off"
                    aria-label="Your answer"
                    className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                  <button type="submit" disabled={!checkAnswer.trim()}>
                    Check answer
                  </button>
                  <button type="button" onClick={() => setShowHint((value) => !value)}>
                    {showHint ? "Hide hint" : "Hint"}
                  </button>
                </form>
              )}
              {showHint && checkStage !== "correct" ? (
                <p className="lesson-challenge-detail">
                  {checkStage === "remediation"
                    ? lesson.challenge.remediation?.simplerHint
                    : lesson.challenge.hint}
                </p>
              ) : null}
            </section>
          ) : null}

          {completed ? (
            <section className="lesson-completion" aria-live="polite">
              <h3>You completed: {lesson.title}</h3>
              <div className="text-[10px] uppercase tracking-[0.2em] text-sky-200">
                Final result
              </div>
              <p>{lesson.solution.answer}</p>
              <div className="text-[10px] uppercase tracking-[0.2em] text-sky-200">Takeaway</div>
              <p>{lesson.takeaway}</p>
              <p className="lesson-solution-verification">
                <strong>Checked:</strong> {lesson.solution.verification}
              </p>
              <div className="lesson-completion-actions">
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary"
                  aria-label="Replay lesson from the beginning"
                  onClick={() => {
                    setSceneIndex(0);
                    updateElapsed(0);
                    setIsPlaying(!reducedMotion);
                    setCheckStage("ready");
                    setCheckAnswer("");
                    setCheckFeedback(null);
                    setShowHint(false);
                  }}
                >
                  Replay
                </button>
                <button type="button" className="ds-btn ds-btn--primary" onClick={onAskFollowUp}>
                  Ask a follow-up
                </button>
              </div>
              {nextTopics.length > 0 ? (
                <div className="lesson-next-topics" aria-label="Suggested next topics">
                  {nextTopics.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      className="ds-btn ds-btn--ghost"
                      onClick={() => onSuggestedTopic?.(topic)}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
