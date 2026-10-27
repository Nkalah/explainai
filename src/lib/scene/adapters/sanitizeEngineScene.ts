import type { AnimationType, ObjectType, Scene, SceneAnnotation, SceneObject, Vec2, VisualStrategy, SceneImageSource } from "../../engineTypes";

export const VALID_OBJECT_TYPES: ObjectType[] = [
  "text",
  "equation",
  "label",
  "code",
  "rectangle",
  "circle",
  "triangle",
  "line",
  "arrow",
  "doubleArrow",
  "graph",
  "barChart",
  "pieChart",
  "scatterPlot",
  "table",
  "array",
  "stack",
  "highlightBox",
  "callout",
  "icon",
  "image",
  "annotation",
];

export const VALID_ANIMATION_TYPES: AnimationType[] = [
  "write",
  "draw",
  "erase",
  "fadeIn",
  "fadeOut",
  "highlight",
  "underline",
  "circle",
  "pulse",
  "zoom",
  "move",
  "rotate",
  "grow",
  "shrink",
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "reveal",
  "blink",
  "trace",
  "staggerFade",
];

export const VALID_COLORS = ["foreground", "brand", "muted"] as const;

export const VALID_VISUAL_STRATEGIES: VisualStrategy[] = [
  "whiteboard-only",
  "image-primary",
  "image-annotation",
  "diagram-overlay",
  "comparison",
];

export const VALID_SCENE_IMAGE_SOURCES: SceneImageSource[] = [
  "generated-svg",
  "external-url",
  "fallback-svg",
];

function clampNum(v: any, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && !Number.isNaN(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeVec2Array(raw: any, max: number): Vec2[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const pts = raw
    .filter((p: any) => typeof p?.x === "number" && typeof p?.y === "number")
    .slice(0, max);
  return pts.length >= 2 ? pts : undefined;
}

export function sanitizeEngineObject(raw: any, index: number): SceneObject | null {
  if (!raw || typeof raw !== "object") return null;

  const type: ObjectType = VALID_OBJECT_TYPES.includes(raw.type) ? raw.type : "text";
  const animRaw = raw.animation ?? {};
  const animation = {
    type: (VALID_ANIMATION_TYPES.includes(animRaw.type) ? animRaw.type : "fadeIn") as AnimationType,
    start: clampNum(animRaw.start, 0, 60, 0),
    duration: clampNum(animRaw.duration, 0.1, 10, 0.6),
  };

  const obj: SceneObject = {
    id: typeof raw.id === "string" ? raw.id.slice(0, 40) : `obj_${index}`,
    type,
    position: {
      x: clampNum(raw.position?.x, 0, 100, 50),
      y: clampNum(raw.position?.y, 0, 100, 50),
    },
    width: raw.width != null ? clampNum(raw.width, 1, 100, 20) : undefined,
    height: raw.height != null ? clampNum(raw.height, 1, 100, 20) : undefined,
    rotation: raw.rotation != null ? clampNum(raw.rotation, -180, 180, 0) : undefined,
    layer: raw.layer != null ? clampNum(raw.layer, 0, 20, 1) : 1,
    color: VALID_COLORS.includes(raw.color) ? raw.color : "foreground",
    animation,
  };

  if (typeof raw.text === "string") obj.text = raw.text.slice(0, 80);
  if (typeof raw.iconName === "string") obj.iconName = raw.iconName.slice(0, 40);
  if (typeof raw.source === "string") obj.source = raw.source.slice(0, 120);
  if (typeof raw.imageUrl === "string") obj.imageUrl = raw.imageUrl.slice(0, 500);
  if (typeof raw.imageSvg === "string") obj.imageSvg = raw.imageSvg.slice(0, 5000);

  if (type === "image") {
    if (!obj.imageUrl && !obj.imageSvg) return null;
  }

  if (Array.isArray(raw.annotations)) {
    const annotations: SceneAnnotation[] = raw.annotations
      .filter((a: any) => a && typeof a === "object")
      .slice(0, 8)
      .map((a: any) => ({
        id: typeof a.id === "string" ? a.id.slice(0, 40) : `ann_${Math.random().toString(36).slice(2, 8)}`,
        type: ["arrow", "label", "highlight", "circle", "callout"].includes(a.type) ? a.type : "label",
        position: {
          x: clampNum(a.position?.x, 0, 100, 50),
          y: clampNum(a.position?.y, 0, 100, 50),
        },
        targetPosition: a.targetPosition
          ? {
              x: clampNum(a.targetPosition.x, 0, 100, 50),
              y: clampNum(a.targetPosition.y, 0, 100, 50),
            }
          : undefined,
        text: typeof a.text === "string" ? a.text.slice(0, 80) : undefined,
        color: VALID_COLORS.includes(a.color) ? a.color : "brand",
        animation: {
          type: VALID_ANIMATION_TYPES.includes(a.animation?.type) ? a.animation.type : "fadeIn",
          start: clampNum(a.animation?.start, 0, 60, 0),
          duration: clampNum(a.animation?.duration, 0.1, 10, 0.6),
        },
      }));
    if (annotations.length > 0) obj.annotations = annotations;
  }

  if (type === "graph" || type === "scatterPlot") {
    obj.points = sanitizeVec2Array(raw.points, 30);
    if (!obj.points) return null;
  }

  if (type === "barChart" && Array.isArray(raw.bars)) {
    const bars = raw.bars
      .filter((b: any) => typeof b?.label === "string" && typeof b?.value === "number")
      .slice(0, 10)
      .map((b: any) => ({ label: String(b.label).slice(0, 12), value: b.value }));
    if (bars.length === 0) return null;
    obj.bars = bars;
  }

  if (type === "pieChart" && Array.isArray(raw.slices)) {
    const slices = raw.slices
      .filter((s: any) => typeof s?.label === "string" && typeof s?.value === "number")
      .slice(0, 8)
      .map((s: any) => ({ label: String(s.label).slice(0, 12), value: s.value }));
    if (slices.length === 0) return null;
    obj.slices = slices;
  }

  if (type === "table") {
    const headers = Array.isArray(raw.headers) ? raw.headers.map(String).slice(0, 6) : undefined;
    const rows = Array.isArray(raw.rows)
      ? raw.rows
          .filter((r: any) => Array.isArray(r))
          .map((r: any[]) => r.map(String).slice(0, 6))
          .slice(0, 8)
      : undefined;
    if (!headers || !rows || rows.length === 0) return null;
    obj.headers = headers;
    obj.rows = rows;
  }

  if ((type === "array" || type === "stack") && Array.isArray(raw.values)) {
    const values = raw.values
      .slice(0, 12)
      .map((v: any) => (typeof v === "number" ? v : String(v).slice(0, 8)));
    if (values.length === 0) return null;
    obj.values = values;
  }

  return obj;
}

export function sanitizeEngineScene(raw: any, index: number): Scene | null {
  if (!raw || typeof raw !== "object") return null;

  const objectsRaw = Array.isArray(raw.objects) ? raw.objects : [];
  const objects = objectsRaw
    .map((o: any, i: number) => sanitizeEngineObject(o, i))
    .filter((o: SceneObject | null): o is SceneObject => o !== null)
    .slice(0, 10);

  if (objects.length === 0) return null;

  return {
    id: typeof raw.id === "number" ? raw.id : index + 1,
    title: typeof raw.title === "string" ? raw.title.slice(0, 60) : `Scene ${index + 1}`,
    duration: clampNum(raw.duration, 2, 30, 6),
    camera: {
      zoom: clampNum(raw.camera?.zoom, 0.5, 2.5, 1),
      panX: clampNum(raw.camera?.panX, -30, 30, 0),
      panY: clampNum(raw.camera?.panY, -30, 30, 0),
    },
    narration: typeof raw.narration === "string" ? raw.narration.slice(0, 500) : "",
    transcript: typeof raw.transcript === "string" ? raw.transcript.slice(0, 500) : "",
    objects,
    waitForUser: Boolean(raw.waitForUser),
    visualStrategy: VALID_VISUAL_STRATEGIES.includes(raw.visualStrategy) ? raw.visualStrategy : undefined,
    learningGoal: typeof raw.learningGoal === "string" ? raw.learningGoal.slice(0, 200) : undefined,
    importance: ["core", "supporting", "optional"].includes(raw.importance) ? raw.importance : undefined,
    transition: typeof raw.transition === "string" ? raw.transition.slice(0, 120) : undefined,
    replayable: Boolean(raw.replayable),
    image: raw.image && typeof raw.image === "object"
      ? {
          url: typeof raw.image.url === "string" ? raw.image.url.slice(0, 500) : "",
          prompt: typeof raw.image.prompt === "string" ? raw.image.prompt.slice(0, 500) : "",
          alt: typeof raw.image.alt === "string" ? raw.image.alt.slice(0, 120) : "",
          source: VALID_SCENE_IMAGE_SOURCES.includes(raw.image.source) ? raw.image.source : "fallback-svg",
          strategy: VALID_VISUAL_STRATEGIES.includes(raw.image.strategy) ? raw.image.strategy : "whiteboard-only",
        }
      : undefined,
    annotations: Array.isArray(raw.annotations)
      ? raw.annotations
          .filter((a: any) => a && typeof a === "object")
          .slice(0, 8)
          .map((a: any) => ({
            id: typeof a.id === "string" ? a.id.slice(0, 40) : `ann_${Math.random().toString(36).slice(2, 8)}`,
            type: ["arrow", "label", "highlight", "circle", "callout"].includes(a.type) ? a.type : "label",
            position: {
              x: clampNum(a.position?.x, 0, 100, 50),
              y: clampNum(a.position?.y, 0, 100, 50),
            },
            targetPosition: a.targetPosition
              ? {
                  x: clampNum(a.targetPosition.x, 0, 100, 50),
                  y: clampNum(a.targetPosition.y, 0, 100, 50),
                }
              : undefined,
            text: typeof a.text === "string" ? a.text.slice(0, 80) : undefined,
            color: VALID_COLORS.includes(a.color) ? a.color : "brand",
            animation: {
              type: VALID_ANIMATION_TYPES.includes(a.animation?.type) ? a.animation.type : "fadeIn",
              start: clampNum(a.animation?.start, 0, 60, 0),
              duration: clampNum(a.animation?.duration, 0.1, 10, 0.6),
            },
          }))
      : undefined,
  };
}
