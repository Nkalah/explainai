import type { AnimationType, ObjectType, Scene, SceneObject, Vec2 } from "../../engineTypes";

export const VALID_OBJECT_TYPES: ObjectType[] = [
  "text", "equation", "label", "code",
  "rectangle", "circle", "triangle", "line", "arrow", "doubleArrow",
  "graph", "barChart", "pieChart", "scatterPlot",
  "table", "array", "stack",
  "highlightBox", "callout", "icon",
];

export const VALID_ANIMATION_TYPES: AnimationType[] = [
  "write", "draw", "erase", "fadeIn", "fadeOut", "highlight",
  "underline", "circle", "pulse", "zoom", "move", "rotate",
  "grow", "shrink", "slideLeft", "slideRight", "slideUp", "slideDown",
  "reveal", "blink",
];

export const VALID_COLORS = ["foreground", "brand", "muted"] as const;

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
      ? raw.rows.filter((r: any) => Array.isArray(r)).map((r: any[]) => r.map(String).slice(0, 6)).slice(0, 8)
      : undefined;
    if (!headers || !rows || rows.length === 0) return null;
    obj.headers = headers;
    obj.rows = rows;
  }

  if ((type === "array" || type === "stack") && Array.isArray(raw.values)) {
    const values = raw.values.slice(0, 12).map((v: any) => (typeof v === "number" ? v : String(v).slice(0, 8)));
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
  };
}