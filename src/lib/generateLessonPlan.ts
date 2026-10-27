import type {
  LessonPlan,
  DifficultyLevel,
  TeachingStrategyStep,
  VisualRecommendation,
  ExplanationMode,
  InteractionPoint,
} from "./lessonPlan";

const VALID_DIFFICULTIES: DifficultyLevel[] = [
  "Elementary",
  "Middle School",
  "High School",
  "Beginner",
  "Intermediate",
  "Advanced",
  "University",
];

const VALID_STRATEGY_STEPS: TeachingStrategyStep[] = [
  "Introduction",
  "Concept",
  "Analogy",
  "Visualization",
  "WorkedExample",
  "Practice",
  "CommonMistakes",
  "Recap",
  "Quiz",
];

const VALID_VISUALS: VisualRecommendation[] = [
  "Equation",
  "Graph",
  "Table",
  "Diagram",
  "Flowchart",
  "Timeline",
  "CodeAnimation",
  "Shape",
  "Chart",
  "Array",
  "Stack",
  "Icon",
  "None",
];

const VALID_EXPLANATION_MODES: ExplanationMode[] = ["visual-first", "text-first", "balanced"];

export type GroqUsage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };

import { callGroqJson } from "./groqClient";

function clampNum(v: any, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && !Number.isNaN(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeStrategy(raw: any): TeachingStrategyStep[] {
  if (!Array.isArray(raw)) return ["Introduction", "Concept", "WorkedExample", "Recap"];
  const steps = raw.filter((s: any) => VALID_STRATEGY_STEPS.includes(s)).slice(0, 9);
  return steps.length > 0 ? steps : ["Introduction", "Concept", "WorkedExample", "Recap"];
}

function sanitizeVisuals(raw: any): VisualRecommendation[] {
  if (!Array.isArray(raw)) return ["None"];
  const visuals = raw.filter((v: any) => VALID_VISUALS.includes(v)).slice(0, 6);
  return visuals.length > 0 ? visuals : ["None"];
}

function sanitizeInteractionPoints(raw: any): InteractionPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p: any) => VALID_STRATEGY_STEPS.includes(p?.afterStrategyStep))
    .slice(0, 5)
    .map((p: any) => ({
      afterStrategyStep: p.afterStrategyStep as TeachingStrategyStep,
      reason: typeof p.reason === "string" ? p.reason.slice(0, 120) : "",
    }));
}

function sanitizePlan(raw: any): LessonPlan {
  return {
    subject:
      typeof raw?.subject === "string" && raw.subject.trim() ? raw.subject.slice(0, 60) : "General",
    difficulty: VALID_DIFFICULTIES.includes(raw?.difficulty) ? raw.difficulty : "Intermediate",
    objective: typeof raw?.objective === "string" ? raw.objective.slice(0, 200) : "",
    estimatedDuration: clampNum(raw?.estimatedDuration, 30, 900, 120),
    prerequisites: Array.isArray(raw?.prerequisites)
      ? raw.prerequisites
          .filter((p: any) => typeof p === "string")
          .slice(0, 8)
          .map((p: string) => p.slice(0, 80))
      : [],
    requiresPrerequisiteCheck: Boolean(raw?.requiresPrerequisiteCheck),
    teachingStrategy: sanitizeStrategy(raw?.teachingStrategy),
    useAnalogy: Boolean(raw?.useAnalogy),
    useWorkedExample: Boolean(raw?.useWorkedExample),
    explanationMode: VALID_EXPLANATION_MODES.includes(raw?.explanationMode)
      ? raw.explanationMode
      : "balanced",
    recommendedVisuals: sanitizeVisuals(raw?.recommendedVisuals),
    includeAnimations: raw?.includeAnimations != null ? Boolean(raw.includeAnimations) : true,
    includeCodeExecution: Boolean(raw?.includeCodeExecution),
    interactionPoints: sanitizeInteractionPoints(raw?.interactionPoints),
    includeQuiz: Boolean(raw?.includeQuiz),
    includePractice: Boolean(raw?.includePractice),
    confidence: clampNum(raw?.confidence, 0, 1, 0.7),
    confidenceReason:
      typeof raw?.confidenceReason === "string" ? raw.confidenceReason.slice(0, 200) : "",
    planningNotes: typeof raw?.planningNotes === "string" ? raw.planningNotes.slice(0, 300) : "",
  };
}

/**
 * Generates a pedagogical lesson plan for a question, BEFORE any scene/visual
 * content is produced. This is a plain function (not a server fn) because it's
 * always called from within another server function's handler — no need for
 * its own network round-trip from the client.
 */
export async function generateLessonPlan(
  question: string,
): Promise<{ plan: LessonPlan; usage?: GroqUsage }> {
  const { data, usage } = await callGroqJson([
    {
      role: "system",
      content: `You are a curriculum design expert who plans lessons before any content is written. You do NOT write the lesson itself — you decide HOW it should be taught. This planner must work for any academic subject and any level, from elementary school through university.

Respond with ONLY valid JSON, no markdown, no code fences, no extra text, in exactly this shape:
{
  "subject": "short subject name, e.g. 'Algebra', 'Programming', 'US History', 'Cell Biology'",
  "difficulty": "Elementary" | "Middle School" | "High School" | "Beginner" | "Intermediate" | "Advanced" | "University",
  "objective": "one sentence: what the student will understand after this lesson",
  "estimatedDuration": 120,
  "prerequisites": ["concept the student should already know", "..."],
  "requiresPrerequisiteCheck": false,
  "teachingStrategy": ["Introduction", "Concept", "Analogy", "Visualization", "WorkedExample", "Practice", "CommonMistakes", "Recap", "Quiz"],
  "useAnalogy": true,
  "useWorkedExample": true,
  "explanationMode": "visual-first" | "text-first" | "balanced",
  "recommendedVisuals": ["Equation", "Graph", "Table", "Diagram", "Flowchart", "Timeline", "CodeAnimation", "Shape", "Chart", "Array", "Stack", "Icon", "None"],
  "includeAnimations": true,
  "includeCodeExecution": false,
  "interactionPoints": [{ "afterStrategyStep": "Concept", "reason": "short reason a pause helps here" }],
  "includeQuiz": false,
  "includePractice": false,
  "planningNotes": "one or two sentences explaining your reasoning for these choices"
}

Field guidance:
- "teachingStrategy" is an ORDERED sequence — only include the steps that genuinely make sense for this question. A simple factual question might just be ["Introduction", "Concept", "Recap"]. A hard problem-solving question might use most of the steps. Include "Quiz" as the last step only if "includeQuiz" is true.
- "recommendedVisuals" should reflect what actually helps this specific topic, not a generic list — a definitional history question might genuinely be "None" or ["Timeline"], while a math problem might be ["Equation", "Graph"].
- "includeCodeExecution" should be true only for programming questions where showing code running step by step would help — this is a forward-looking flag, not something currently implemented, so it's fine to still set it accurately.
- "interactionPoints" should be sparse — 0 to 2 points, only where a genuine pause helps (e.g. after a dense concept, before revealing an answer).
- "includeQuiz"/"includePractice" should be true only when reinforcing the concept with questions afterward would clearly help (e.g. a skill to practice), not for every lesson.
- "difficulty" should reflect the actual level implied by the question's phrasing and complexity — don't default to "Intermediate" without reason.
- Output ONLY the JSON object.`,
    },
    { role: "user", content: question },
  ]);

  return { plan: sanitizePlan(data ?? {}), usage };
}
