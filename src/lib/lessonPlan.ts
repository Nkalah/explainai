// The Lesson Planner's output. This is the "brain" — a structured pedagogical
// decision made BEFORE any scene/animation content is written. Nothing here
// describes pixels, SVGs, or timing; it describes teaching decisions.

export type DifficultyLevel =
  | "Elementary"
  | "Middle School"
  | "High School"
  | "Beginner"
  | "Intermediate"
  | "Advanced"
  | "University";

// A step in the pedagogical sequence. Deliberately not tied to any specific
// subject — "WorkedExample" means something different in math vs. history,
// but the *strategy slot* is the same shape.
export type TeachingStrategyStep =
  | "Introduction"
  | "Concept"
  | "Analogy"
  | "Visualization"
  | "WorkedExample"
  | "Practice"
  | "CommonMistakes"
  | "Recap"
  | "Quiz";

// What KIND of visual would help, not HOW to render it. The scene generator
// still owns actual object types (equation/graph/table/etc from engineTypes.ts).
// This is a hint layer above that, one level more abstract.
export type VisualRecommendation =
  | "Equation"
  | "Graph"
  | "Table"
  | "Diagram"
  | "Flowchart"
  | "Timeline"
  | "CodeAnimation"
  | "Shape"
  | "Chart"
  | "Array"
  | "Stack"
  | "Icon"
  | "None";

export type ExplanationMode = "visual-first" | "text-first" | "balanced";

export interface InteractionPoint {
  afterStrategyStep: TeachingStrategyStep;
  reason: string; // why a pause makes sense here, e.g. "concept is dense, let it sink in"
}

export interface LessonPlan {
  // --- Identity ---
  subject: string; // free-text but normalized, e.g. "Programming", "US History", "Algebra"
  difficulty: DifficultyLevel;
  objective: string; // one sentence: what the student understands after this lesson
  estimatedDuration: number; // seconds, rough total across all scenes

  // --- Prior knowledge ---
  prerequisites: string[];
  requiresPrerequisiteCheck: boolean; // true if the topic is risky to teach without confirming basics first

  // --- Pedagogy ---
  teachingStrategy: TeachingStrategyStep[]; // ordered sequence, e.g. ["Introduction","Analogy","WorkedExample","Recap"]
  useAnalogy: boolean;
  useWorkedExample: boolean;
  explanationMode: ExplanationMode;

  // --- Visuals (hints only, not implementation) ---
  recommendedVisuals: VisualRecommendation[];
  includeAnimations: boolean;

  // --- Reserved for future capability, not implemented in the scene generator yet ---
  includeCodeExecution: boolean;

  // --- Engagement ---
  interactionPoints: InteractionPoint[];
  includeQuiz: boolean;
  includePractice: boolean;

  // --- Transparency / debugging ---
  confidence: number; // 0-1, the planner's confidence in this pedagogical plan
  confidenceReason: string; // short rationale for that confidence level
  planningNotes: string; // short free-text rationale, useful for logs and future tuning
}
