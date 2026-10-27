// The Scene Generation Engine's output. This describes WHAT the learner
// should experience and WHY — educational intent, teaching primitives,
// sequencing, misconceptions, pacing — and nothing about HOW it is drawn.
// No pixels, positions, colors, or SVG/animation-library concepts belong
// here. A SceneAdapter (see adapters/) is responsible for translating this
// into renderer-specific structures (today: engineTypes.ts's Scene/SceneObject).

export type SceneCategory =
  "Explanation" | "Example" | "Practice" | "Assessment" | "Transition" | "Recap";

export type EducationalIntent =
  | "IntroduceConcept"
  | "RecallPriorKnowledge"
  | "BuildIntuition"
  | "ShowAnalogy"
  | "VisualizeProcess"
  | "CompareIdeas"
  | "TransformEquation"
  | "TraceExecution"
  | "ExplainCause"
  | "ExplainEffect"
  | "DemonstrateAlgorithm"
  | "BreakIntoSteps"
  | "CorrectMisconception"
  | "Summarize"
  | "AssessUnderstanding"
  | "Practice"
  | "Review";

// Reusable across every subject — a math "Transform" (e.g. algebraic
// manipulation) and a history "Transform" (e.g. a territory changing hands
// on a map) are the same teaching action at this level of abstraction.
export type TeachingPrimitive =
  | "Reveal"
  | "Hide"
  | "Write"
  | "Erase"
  | "Highlight"
  | "Underline"
  | "Circle"
  | "Zoom"
  | "Focus"
  | "Compare"
  | "Split"
  | "Merge"
  | "Transform"
  | "Rotate"
  | "Move"
  | "Trace"
  | "Label"
  | "Count"
  | "Expand"
  | "Collapse"
  | "Pause"
  | "Question"
  | "Answer"
  | "Repeat"
  | "Summarize";

export type VisualGoalType =
  | "Equation"
  | "Graph"
  | "Table"
  | "Diagram"
  | "Flowchart"
  | "Timeline"
  | "CodeTrace"
  | "Shape"
  | "Chart"
  | "ArrayOrStack"
  | "Icon"
  | "Comparison"
  | "None";

export type InteractionType = "None" | "WaitForContinue" | "PromptQuestion" | "RevealOnDemand";
export type CameraFocus = "wide" | "focused" | "detail";
export type SceneImportance = "core" | "supporting" | "optional";
export type PacingDensity = "sparse" | "standard" | "dense";

export interface VisualFocus {
  type: VisualGoalType;
  /** Why this visual reduces cognitive load — never "looks good"/"is engaging". */
  purpose: string;
  /** Short label of the specific thing to depict, e.g. "the coefficient 3", not raw content. */
  focusSubject: string;
}

export interface MisconceptionAddressed {
  /** e.g. "Students think recursion is looping." */
  misconception: string;
  correction: string;
}

export interface PlannedScene {
  id: number;
  type: SceneCategory;
  educationalIntent: EducationalIntent;
  /** What the learner should understand after THIS scene specifically. */
  objective: string;
  /** Why this scene exists — the answer to "what misconception does it solve /
   *  what does it build toward", in plain language. */
  teachingReason: string;
  narration: string;
  /** Ordered sequence of teaching actions within this scene — progressive
   *  revelation happens by listing primitives in the order attention should move. */
  primitives: TeachingPrimitive[];
  visualFocus: VisualFocus;
  importance: SceneImportance;
  duration: number; // seconds, teacher's estimate — the adapter may adjust slightly
  /** How many distinct progressive-reveal beats happen within the scene
   *  (e.g. "highlight variable" -> "show operation" -> "reveal result" = 3). */
  revealSteps: number;
  interactionType: InteractionType;
  cameraFocus: CameraFocus;
  /** Which earlier scene this one depends on understanding first, or null for none. */
  prerequisiteReference: number | null;
  /** Which later scene this one sets up, or null if it doesn't specifically prepare one. */
  preparesForSceneId: number | null;
  misconceptionsAddressed: MisconceptionAddressed[];
  /** One sentence bridging from the previous scene. Empty string only for scene 1. */
  transition: string;
}

export interface ScenePlan {
  title: string;
  objective: string;
  /** Which subject-specific structure was used and why, e.g.
   *  "Mathematics: Concept -> Visual equation -> Worked example -> Practice". */
  subjectStrategy: string;
  adaptedFor: {
    difficulty: string;
    /** Beginner -> sparse (more scenes, more repetition, more pauses).
     *  Advanced -> dense (fewer scenes, higher density, less narration). */
    density: PacingDensity;
  };
  /** Subject-level misconceptions identified before being mapped to specific scenes. */
  identifiedMisconceptions: string[];
  scenes: PlannedScene[];
}
