export type Vec2 = { x: number; y: number };

export type ObjectType =
  | "text"
  | "equation"
  | "label"
  | "code"
  | "rectangle"
  | "circle"
  | "triangle"
  | "line"
  | "arrow"
  | "doubleArrow"
  | "graph"
  | "barChart"
  | "pieChart"
  | "scatterPlot"
  | "table"
  | "array"
  | "stack"
  | "highlightBox"
  | "callout"
  | "icon"
  | "image"
  | "annotation";

export type AnimationType =
  | "write"
  | "draw"
  | "erase"
  | "fadeIn"
  | "fadeOut"
  | "highlight"
  | "underline"
  | "circle"
  | "pulse"
  | "zoom"
  | "move"
  | "rotate"
  | "grow"
  | "shrink"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown"
  | "reveal"
  | "blink"
  | "trace"
  | "staggerFade";

export type VisualStrategy =
  "whiteboard-only" | "image-primary" | "image-annotation" | "diagram-overlay" | "comparison";

export type SceneImageSource = "generated-svg" | "external-url" | "fallback-svg";

export type SceneImage = {
  url: string;
  prompt: string;
  alt: string;
  source: SceneImageSource;
  strategy: VisualStrategy;
};

export type SceneAnnotation = {
  id: string;
  type: "arrow" | "label" | "highlight" | "circle" | "callout";
  position: Vec2;
  targetPosition?: Vec2;
  text?: string;
  color?: "foreground" | "brand" | "muted";
  animation: {
    type: AnimationType;
    start: number;
    duration: number;
  };
};

export type SceneObject = {
  id: string;
  type: ObjectType;
  position: Vec2; // percentage 0-100 within the scene canvas
  width?: number; // percentage 0-100
  height?: number; // percentage 0-100
  rotation?: number; // degrees
  layer?: number;
  color?: "foreground" | "brand" | "muted";
  text?: string;
  source?: string;
  targetPosition?: Vec2;
  // type-specific payloads
  points?: Vec2[]; // graph / scatterPlot
  bars?: { label: string; value: number }[]; // barChart
  slices?: { label: string; value: number }[]; // pieChart
  headers?: string[]; // table
  rows?: string[][]; // table
  values?: (string | number)[]; // array / stack
  iconName?: string; // icon (lucide-react key, e.g. "Lightbulb")
  imageUrl?: string; // image object: external URL or data URI
  imageSvg?: string; // image object: inline SVG markup
  annotations?: SceneAnnotation[]; // image object: overlay annotations
  animation: {
    type: AnimationType;
    start: number; // seconds, relative to scene start
    duration: number; // seconds
  };
};

export type Camera = { zoom: number; panX: number; panY: number };

export type Scene = {
  id: number;
  title: string;
  duration: number;
  camera: Camera;
  narration: string;
  transcript: string;
  objects: SceneObject[];
  waitForUser?: boolean;
  visualStrategy?: VisualStrategy;
  image?: SceneImage;
  annotations?: SceneAnnotation[];
  learningGoal?: string;
  importance?: "core" | "supporting" | "optional";
  transition?: string;
  replayable?: boolean;
};

export type EngineLesson = {
  title: string;
  objective: string;
  scenes: Scene[];
  totalDuration?: number;
};
