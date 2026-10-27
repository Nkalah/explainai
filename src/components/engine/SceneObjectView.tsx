import * as LucideIcons from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SceneObject, Vec2 } from "@/lib/engineTypes";

const colorVar: Record<string, string> = {
  foreground: "var(--color-foreground)",
  brand: "var(--color-brand)",
  muted: "var(--color-muted-foreground)",
};

function animationStyle(obj: SceneObject): React.CSSProperties {
  const { type, start, duration } = obj.animation;
  const delay = `${start}s`;
  const dur = `${duration}s`;

  const map: Record<string, string> = {
    write: `eng-fade ${dur} ease-out ${delay} both`,
    draw: `eng-fade ${dur} ease-out ${delay} both`,
    erase: `eng-fade-out ${dur} ease-in ${delay} both`,
    fadeIn: `eng-fade ${dur} ease-out ${delay} both`,
    fadeOut: `eng-fade-out ${dur} ease-in ${delay} both`,
    highlight: `eng-highlight ${dur} ease-out ${delay} both`,
    underline: `eng-fade ${dur} ease-out ${delay} both`,
    circle: `eng-fade ${dur} ease-out ${delay} both`,
    pulse: `eng-pulse ${dur} ease-in-out ${delay} 2`,
    zoom: `eng-zoom ${dur} cubic-bezier(0.2,0.8,0.3,1) ${delay} both`,
    move: `eng-slide-left ${dur} ease-out ${delay} both`,
    rotate: `eng-rotate ${dur} ease-out ${delay} both`,
    grow: `eng-zoom ${dur} ease-out ${delay} both`,
    shrink: `eng-fade-out ${dur} ease-in ${delay} both`,
    slideLeft: `eng-slide-left ${dur} ease-out ${delay} both`,
    slideRight: `eng-slide-right ${dur} ease-out ${delay} both`,
    slideUp: `eng-slide-up ${dur} ease-out ${delay} both`,
    slideDown: `eng-slide-down ${dur} ease-out ${delay} both`,
    reveal: `eng-fade ${dur} ease-out ${delay} both`,
    blink: `eng-pulse ${dur} ease-in-out ${delay} 3`,
  };

  return { animation: map[type] ?? map.fadeIn };
}

function textFontSize(base: number, text: string | undefined): string {
  const len = text?.length ?? 0;
  const lengthFactor = len > 40 ? 0.72 : len > 24 ? 0.85 : 1;
  const min = (base * 0.62 * lengthFactor).toFixed(2);
  const max = (base * lengthFactor).toFixed(2);
  return `clamp(${min}rem, ${(base * 2.1 * lengthFactor).toFixed(2)}vw, ${max}rem)`;
}

const textBoxBase: React.CSSProperties = {
  maxWidth: "88%",
  whiteSpace: "normal",
  overflowWrap: "break-word",
  wordBreak: "break-word",
  textAlign: "center",
  lineHeight: 1.3,
};

/* ============================================================
   Graphing engine — shared by "graph" and "scatterPlot"
   ============================================================ */

type SvgPoint = { x: number; y: number };

/** Formats an axis tick number compactly: trims to at most 1 decimal and
 *  drops a trailing ".0" so "3.0" renders as "3". */
function formatTick(n: number): string {
  const rounded = Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Picks `count` evenly spaced values across [min, max], always including
 *  both endpoints — simple and predictable rather than "nice-number"
 *  rounded, which keeps every graph's axis internally consistent. */
function evenTicks(min: number, max: number, count: number): number[] {
  if (max - min === 0) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

/** Converts a Catmull-Rom spline through `points` into a cubic-bezier SVG
 *  path string, so a handful of data points render as a smooth curve
 *  instead of a jagged polyline — this is what makes something like x^2
 *  actually look like a parabola. */
function smoothPath(points: SvgPoint[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} `;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} `;
  }
  return d;
}

/** A <path> that traces itself on mount using its REAL measured length
 *  (via getTotalLength), synced to the object's own animation timing —
 *  a genuine "drawing" animation rather than a generic opacity fade. */
function AnimatedTracePath({
  d,
  color,
  strokeWidth,
  start,
  duration,
}: {
  d: string;
  color: string;
  strokeWidth: number;
  start: number;
  duration: number;
}) {
  const ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    el.style.transition = "none";
    // Force a reflow so the browser registers the starting offset before
    // the transition below kicks in.
    void el.getBoundingClientRect();
    const timer = setTimeout(() => {
      el.style.transition = `stroke-dashoffset ${Math.max(duration, 0.3)}s ease-out`;
      el.style.strokeDashoffset = "0";
    }, start * 1000);
    return () => clearTimeout(timer);
  }, [d, start, duration]);

  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

interface GraphFrame {
  sx: (x: number) => number;
  sy: (y: number) => number;
  xTicks: number[];
  yTicks: number[];
  x0: number;
  y0: number;
  W: number;
  H: number;
  PAD: number;
}

function buildGraphFrame(points: Vec2[]): GraphFrame {
  const W = 100,
    H = 100,
    PAD = 16;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(0, ...xs);
  const maxX = Math.max(0, ...xs) || 1;
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(0, ...ys) || 1;

  const sx = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - ((y - minY) / (maxY - minY || 1)) * (H - 2 * PAD);

  const clampedZeroX = Math.min(Math.max(0, minX), maxX);
  const clampedZeroY = Math.min(Math.max(0, minY), maxY);

  return {
    sx,
    sy,
    xTicks: evenTicks(minX, maxX, 5),
    yTicks: evenTicks(minY, maxY, 5),
    x0: sx(clampedZeroX),
    y0: sy(clampedZeroY),
    W,
    H,
    PAD,
  };
}

function GraphAxes({ frame, color }: { frame: GraphFrame; color: string }) {
  const { sx, sy, xTicks, yTicks, x0, y0, W, H, PAD } = frame;
  const axisColor = "var(--color-muted-foreground)";

  return (
    <g>
      {/* gridlines */}
      {xTicks.map((t, i) => (
        <line
          key={`gx${i}`}
          x1={sx(t)}
          y1={PAD}
          x2={sx(t)}
          y2={H - PAD}
          stroke={axisColor}
          strokeWidth="0.25"
          opacity="0.25"
        />
      ))}
      {yTicks.map((t, i) => (
        <line
          key={`gy${i}`}
          x1={PAD}
          y1={sy(t)}
          x2={W - PAD}
          y2={sy(t)}
          stroke={axisColor}
          strokeWidth="0.25"
          opacity="0.25"
        />
      ))}

      {/* axes */}
      <line
        x1={PAD}
        y1={y0}
        x2={W - PAD}
        y2={y0}
        stroke={axisColor}
        strokeWidth="0.6"
        opacity="0.7"
      />
      <line
        x1={x0}
        y1={PAD}
        x2={x0}
        y2={H - PAD}
        stroke={axisColor}
        strokeWidth="0.6"
        opacity="0.7"
      />

      {/* axis arrowheads */}
      <path
        d={`M ${W - PAD - 2.5} ${y0 - 1.5} L ${W - PAD} ${y0} L ${W - PAD - 2.5} ${y0 + 1.5}`}
        fill="none"
        stroke={axisColor}
        strokeWidth="0.6"
        opacity="0.7"
      />
      <path
        d={`M ${x0 - 1.5} ${PAD + 2.5} L ${x0} ${PAD} L ${x0 + 1.5} ${PAD + 2.5}`}
        fill="none"
        stroke={axisColor}
        strokeWidth="0.6"
        opacity="0.7"
      />

      {/* tick labels */}
      {xTicks.map((t, i) => (
        <text
          key={`tx${i}`}
          x={sx(t)}
          y={y0 + 4.5}
          fontSize="3.2"
          textAnchor="middle"
          fill={axisColor}
          stroke="none"
          opacity="0.85"
        >
          {formatTick(t)}
        </text>
      ))}
      {yTicks.map((t, i) => (
        <text
          key={`ty${i}`}
          x={x0 - 2}
          y={sy(t) + 1}
          fontSize="3.2"
          textAnchor="end"
          fill={axisColor}
          stroke="none"
          opacity="0.85"
        >
          {formatTick(t)}
        </text>
      ))}
    </g>
  );
}

/* ============================================================
   Main component
   ============================================================ */

export function SceneObjectView({ obj }: { obj: SceneObject }) {
  const color = colorVar[obj.color ?? "foreground"];
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${obj.position.x}%`,
    top: `${obj.position.y}%`,
    width: obj.width ? `${obj.width}%` : undefined,
    height: obj.height ? `${obj.height}%` : undefined,
    transform: `translate(-50%, -50%) rotate(${obj.rotation ?? 0}deg)`,
    zIndex: obj.layer ?? 1,
    ...animationStyle(obj),
  };

  if (obj.type === "image") {
    return <ImageObjectView obj={obj} style={style} />;
  }

  if (obj.type === "annotation") {
    return <AnnotationObjectView obj={obj} style={style} color={color} />;
  }

  switch (obj.type) {
    case "text":
    case "label":
      return (
        <div
          style={{ ...style, ...textBoxBase, color, fontSize: textFontSize(1.1, obj.text) }}
          className="font-sans"
        >
          {obj.text}
        </div>
      );

    case "equation":
      return (
        <div
          style={{ ...style, ...textBoxBase, color, fontSize: textFontSize(1.6, obj.text) }}
          className="font-display"
        >
          {obj.text}
        </div>
      );

    case "code":
      return (
        <pre
          style={{
            ...style,
            transform: "translate(-50%, -50%)",
            maxWidth: "90%",
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            wordBreak: "break-word",
            textAlign: "left",
          }}
          className="rounded-lg border bg-secondary/60 px-3 py-2 font-mono text-[0.7rem] leading-relaxed sm:text-xs"
        >
          {obj.text}
        </pre>
      );

    case "callout":
      return (
        <div
          style={{
            ...style,
            maxWidth: "min(65%, 260px)",
            whiteSpace: "normal",
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
          className="rounded-xl border bg-card px-3 py-2 text-xs leading-snug shadow-sm"
        >
          {obj.text}
        </div>
      );

    case "highlightBox":
      return (
        <div
          style={{
            ...style,
            border: `2px solid ${color}`,
            borderRadius: 8,
            background: "transparent",
          }}
        />
      );

    case "icon": {
      const Icon = (LucideIcons as any)[obj.iconName ?? "Lightbulb"] ?? LucideIcons.Lightbulb;
      return (
        <div style={style}>
          <Icon color={color} size={40} strokeWidth={1.8} />
        </div>
      );
    }

    case "rectangle":
      return (
        <svg style={style} viewBox="0 0 100 100" className="overflow-visible">
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            className="stroke-draw"
          />
        </svg>
      );

    case "circle":
      return (
        <svg style={style} viewBox="0 0 100 100" className="overflow-visible">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            className="stroke-draw"
          />
        </svg>
      );

    case "triangle":
      return (
        <svg style={style} viewBox="0 0 100 100" className="overflow-visible">
          <polygon
            points="50,5 5,95 95,95"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            className="stroke-draw"
          />
        </svg>
      );

    case "line":
      return (
        <svg style={style} viewBox="0 0 100 100" className="overflow-visible">
          <line
            x1="5"
            y1="95"
            x2="95"
            y2="5"
            stroke={color}
            strokeWidth="2.5"
            className="stroke-draw"
          />
        </svg>
      );

    case "arrow":
      return (
        <svg style={style} viewBox="0 0 100 40" className="overflow-visible">
          <line
            x1="5"
            y1="20"
            x2="80"
            y2="20"
            stroke={color}
            strokeWidth="2.5"
            className="stroke-draw"
          />
          <path
            d="M65 8 L85 20 L65 32"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "doubleArrow":
      return (
        <svg style={style} viewBox="0 0 100 40" className="overflow-visible">
          <line
            x1="15"
            y1="20"
            x2="85"
            y2="20"
            stroke={color}
            strokeWidth="2.5"
            className="stroke-draw"
          />
          <path
            d="M35 8 L15 20 L35 32"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M65 8 L85 20 L65 32"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "graph": {
      const points = obj.points ?? [];
      if (points.length < 2) return null;
      const sorted = [...points].sort((a, b) => a.x - b.x);
      const frame = buildGraphFrame(sorted);
      const svgPoints: SvgPoint[] = sorted.map((p) => ({ x: frame.sx(p.x), y: frame.sy(p.y) }));
      const d = smoothPath(svgPoints);

      return (
        <svg style={style} viewBox="0 0 100 100" className="overflow-visible">
          <GraphAxes frame={frame} color={color} />
          <AnimatedTracePath
            d={d}
            color={color}
            strokeWidth={2.4}
            start={obj.animation.start}
            duration={Math.max(obj.animation.duration, 1)}
          />
        </svg>
      );
    }

    case "scatterPlot": {
      const points = obj.points ?? [];
      if (points.length === 0) return null;
      const frame = buildGraphFrame(points);

      return (
        <svg style={style} viewBox="0 0 100 100" className="overflow-visible">
          <GraphAxes frame={frame} color={color} />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={frame.sx(p.x)}
              cy={frame.sy(p.y)}
              r="2.2"
              fill={color}
              style={{
                animation: `eng-zoom 0.4s cubic-bezier(0.2,0.8,0.3,1) ${obj.animation.start + i * 0.06}s both`,
              }}
            />
          ))}
        </svg>
      );
    }

    case "barChart": {
      const bars = obj.bars ?? [];
      if (bars.length === 0) return null;
      const max = Math.max(...bars.map((b) => b.value)) || 1;
      return (
        <div style={{ ...style, display: "flex", alignItems: "flex-end", gap: "8%" }}>
          {bars.map((b, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1 min-w-0">
              <div
                style={{
                  height: `${(b.value / max) * 100}%`,
                  background: color,
                  width: "100%",
                  transformOrigin: "bottom",
                  animation: `eng-bar-grow 0.5s ease-out ${obj.animation.start + i * 0.08}s both`,
                }}
                className="rounded-t"
              />
              <span className="w-full truncate text-center font-mono text-[9px] text-muted-foreground">
                {b.label}
              </span>
            </div>
          ))}
        </div>
      );
    }

    case "pieChart": {
      const slices = obj.slices ?? [];
      const total = slices.reduce((s, x) => s + x.value, 0) || 1;
      let acc = 0;
      const hues = [
        "var(--color-chart-1)",
        "var(--color-chart-2)",
        "var(--color-chart-3)",
        "var(--color-chart-4)",
        "var(--color-chart-5)",
      ];
      return (
        <svg style={style} viewBox="0 0 100 100" className="overflow-visible">
          {slices.map((s, i) => {
            const start = (acc / total) * 2 * Math.PI;
            acc += s.value;
            const end = (acc / total) * 2 * Math.PI;
            const large = end - start > Math.PI ? 1 : 0;
            const x1 = 50 + 45 * Math.sin(start),
              y1 = 50 - 45 * Math.cos(start);
            const x2 = 50 + 45 * Math.sin(end),
              y2 = 50 - 45 * Math.cos(end);
            return (
              <path
                key={i}
                d={`M50 50 L ${x1.toFixed(1)} ${y1.toFixed(1)} A45 45 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`}
                fill={hues[i % hues.length]}
                opacity="0.85"
                style={{
                  transformOrigin: "50px 50px",
                  animation: `eng-zoom 0.4s cubic-bezier(0.2,0.8,0.3,1) ${obj.animation.start + i * 0.1}s both`,
                }}
              />
            );
          })}
        </svg>
      );
    }

    case "table":
      return (
        <div style={{ ...style, maxWidth: "92%", overflowX: "auto" }}>
          <table className="w-full text-[0.65rem] sm:text-xs">
            <thead>
              <tr>
                {(obj.headers ?? []).map((h, i) => (
                  <th
                    key={i}
                    className="whitespace-nowrap border-b px-2 py-1 text-left font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(obj.rows ?? []).map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td
                      key={ci}
                      className="whitespace-nowrap border-b px-2 py-1 text-muted-foreground"
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "array":
      return (
        <div style={{ ...style, display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
          {(obj.values ?? []).map((v, i) => (
            <div
              key={i}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center border font-mono text-xs sm:h-10 sm:w-10 sm:text-sm"
              style={{
                borderColor: color,
                color,
                animation: `eng-fade 0.3s ease-out ${obj.animation.start + i * 0.05}s both`,
              }}
            >
              {v}
            </div>
          ))}
        </div>
      );

    case "stack":
      return (
        <div
          style={{
            ...style,
            display: "flex",
            flexDirection: "column-reverse",
            alignItems: "center",
          }}
        >
          {(obj.values ?? []).map((v, i) => (
            <div
              key={i}
              className="flex h-8 w-14 items-center justify-center border-x border-t font-mono text-xs last:border-b sm:h-9 sm:w-16 sm:text-sm"
              style={{
                borderColor: color,
                color,
                animation: `eng-slide-up 0.3s ease-out ${obj.animation.start + i * 0.08}s both`,
              }}
            >
              {v}
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
}

function ImageObjectView({ obj, style }: { obj: SceneObject; style: React.CSSProperties }) {
  const [errored, setErrored] = useState(false);

  if (obj.imageSvg) {
    return (
      <div
        style={{
          ...style,
          maxWidth: "88%",
          maxHeight: "88%",
        }}
        className="overflow-hidden rounded-xl shadow-lg"
        dangerouslySetInnerHTML={{ __html: obj.imageSvg }}
      />
    );
  }

  if (obj.imageUrl && !errored) {
    return (
      <img
        src={obj.imageUrl}
        alt={obj.text || "Educational illustration"}
        style={{
          ...style,
          maxWidth: "88%",
          maxHeight: "88%",
          objectFit: "contain",
        }}
        className="rounded-xl shadow-lg"
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div
      style={{
        ...style,
        maxWidth: "88%",
        maxHeight: "88%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-secondary)",
        borderRadius: 12,
        border: `2px dashed ${colorVar[obj.color ?? "foreground"]}`,
      }}
      className="px-4 py-3 text-center text-xs text-muted-foreground"
    >
      {obj.text || "Visual content"}
    </div>
  );
}

function AnnotationObjectView({
  obj,
  style,
  color,
}: {
  obj: SceneObject;
  style: React.CSSProperties;
  color: string;
}) {
  const target = obj.targetPosition as Vec2 | undefined;

  if (obj.type === "annotation" && target) {
    return (
      <svg
        style={{
          ...style,
          width: "60%",
          height: "40%",
          overflow: "visible",
          pointerEvents: "none",
        }}
        viewBox="0 0 100 60"
        className="overflow-visible"
      >
        <defs>
          <marker
            id={`arrowhead-${obj.id}`}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={color} />
          </marker>
        </defs>
        <line
          x1={obj.position.x}
          y1={obj.position.y}
          x2={target.x}
          y2={target.y}
          stroke={color}
          strokeWidth="2"
          strokeDasharray="4,2"
          markerEnd={`url(#arrowhead-${obj.id})`}
          style={animationStyle(obj)}
        />
      </svg>
    );
  }

  return (
    <div
      style={{
        ...style,
        maxWidth: "min(40%, 200px)",
        whiteSpace: "normal",
        overflowWrap: "break-word",
        background: "var(--color-card)",
        border: `1.5px solid ${color}`,
        borderRadius: 8,
        padding: "4px 8px",
        fontSize: "0.7rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {obj.text}
    </div>
  );
}
