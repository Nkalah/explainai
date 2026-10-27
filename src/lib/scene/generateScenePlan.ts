import type { LessonPlan } from "../lessonPlan";
import type { ToolResult } from "../tools/types";
import type {
  CameraFocus,
  EducationalIntent,
  InteractionType,
  MisconceptionAddressed,
  PacingDensity,
  PlannedScene,
  ScenePlan,
  SceneCategory,
  TeachingPrimitive,
  VisualFocus,
  VisualGoalType,
} from "./scenePlan";

const VALID_SCENE_CATEGORIES: SceneCategory[] = [
  "Explanation",
  "Example",
  "Practice",
  "Assessment",
  "Transition",
  "Recap",
];

const VALID_INTENTS: EducationalIntent[] = [
  "IntroduceConcept",
  "RecallPriorKnowledge",
  "BuildIntuition",
  "ShowAnalogy",
  "VisualizeProcess",
  "CompareIdeas",
  "TransformEquation",
  "TraceExecution",
  "ExplainCause",
  "ExplainEffect",
  "DemonstrateAlgorithm",
  "BreakIntoSteps",
  "CorrectMisconception",
  "Summarize",
  "AssessUnderstanding",
  "Practice",
  "Review",
];

const VALID_PRIMITIVES: TeachingPrimitive[] = [
  "Reveal",
  "Hide",
  "Write",
  "Erase",
  "Highlight",
  "Underline",
  "Circle",
  "Zoom",
  "Focus",
  "Compare",
  "Split",
  "Merge",
  "Transform",
  "Rotate",
  "Move",
  "Trace",
  "Label",
  "Count",
  "Expand",
  "Collapse",
  "Pause",
  "Question",
  "Answer",
  "Repeat",
  "Summarize",
];

const VALID_VISUAL_TYPES: VisualGoalType[] = [
  "Equation",
  "Graph",
  "Table",
  "Diagram",
  "Flowchart",
  "Timeline",
  "CodeTrace",
  "Shape",
  "Chart",
  "ArrayOrStack",
  "Icon",
  "Comparison",
  "None",
];

const VALID_INTERACTIONS: InteractionType[] = [
  "None",
  "WaitForContinue",
  "PromptQuestion",
  "RevealOnDemand",
];
const VALID_CAMERA_FOCUS: CameraFocus[] = ["wide", "focused", "detail"];
const VALID_DENSITY: PacingDensity[] = ["sparse", "standard", "dense"];

export type GroqUsage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };

import { callGroqJson } from "../groqClient";

function clampNum(v: any, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && !Number.isNaN(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

function clampInt(v: any, min: number, max: number, fallback: number): number {
  return Math.round(clampNum(v, min, max, fallback));
}

function sanitizeString(v: any, max: number, fallback = ""): string {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}

function sanitizePrimitives(raw: any): TeachingPrimitive[] {
  if (!Array.isArray(raw)) return ["Reveal"];
  const p = raw.filter((x: any) => VALID_PRIMITIVES.includes(x)).slice(0, 8);
  return p.length > 0 ? p : ["Reveal"];
}

function sanitizeVisualFocus(raw: any): VisualFocus {
  return {
    type: VALID_VISUAL_TYPES.includes(raw?.type) ? raw.type : "None",
    purpose: sanitizeString(raw?.purpose, 160),
    focusSubject: sanitizeString(raw?.focusSubject, 80),
  };
}

function sanitizeMisconceptions(raw: any): MisconceptionAddressed[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m: any) => typeof m?.misconception === "string" && typeof m?.correction === "string")
    .slice(0, 3)
    .map((m: any) => ({
      misconception: m.misconception.slice(0, 160),
      correction: m.correction.slice(0, 160),
    }));
}

function sanitizeScene(raw: any, index: number, total: number): PlannedScene {
  const id = typeof raw?.id === "number" ? raw.id : index + 1;
  return {
    id,
    type: VALID_SCENE_CATEGORIES.includes(raw?.type) ? raw.type : "Explanation",
    educationalIntent: VALID_INTENTS.includes(raw?.educationalIntent)
      ? raw.educationalIntent
      : "IntroduceConcept",
    objective: sanitizeString(raw?.objective, 200),
    teachingReason: sanitizeString(raw?.teachingReason, 200),
    narration: sanitizeString(raw?.narration, 500),
    primitives: sanitizePrimitives(raw?.primitives),
    visualFocus: sanitizeVisualFocus(raw?.visualFocus),
    importance:
      raw?.importance === "supporting" || raw?.importance === "optional" ? raw.importance : "core",
    duration: clampNum(raw?.duration, 2, 30, 6),
    revealSteps: clampInt(raw?.revealSteps, 1, 6, 1),
    interactionType: VALID_INTERACTIONS.includes(raw?.interactionType)
      ? raw.interactionType
      : "None",
    cameraFocus: VALID_CAMERA_FOCUS.includes(raw?.cameraFocus) ? raw.cameraFocus : "wide",
    prerequisiteReference:
      typeof raw?.prerequisiteReference === "number" &&
      raw.prerequisiteReference >= 1 &&
      raw.prerequisiteReference < id
        ? raw.prerequisiteReference
        : null,
    preparesForSceneId:
      typeof raw?.preparesForSceneId === "number" &&
      raw.preparesForSceneId > id &&
      raw.preparesForSceneId <= total
        ? raw.preparesForSceneId
        : null,
    misconceptionsAddressed: sanitizeMisconceptions(raw?.misconceptionsAddressed),
    transition: index === 0 ? "" : sanitizeString(raw?.transition, 160),
  };
}

function sanitizeScenePlan(raw: any): ScenePlan {
  const scenesRaw = Array.isArray(raw?.scenes) ? raw.scenes.slice(0, 10) : [];
  const scenes = scenesRaw.map((s: any, i: number) => sanitizeScene(s, i, scenesRaw.length));

  return {
    title: sanitizeString(raw?.title, 100, "Lesson"),
    objective: sanitizeString(raw?.objective, 200),
    subjectStrategy: sanitizeString(raw?.subjectStrategy, 200),
    adaptedFor: {
      difficulty: sanitizeString(raw?.adaptedFor?.difficulty, 40, "Intermediate"),
      density: VALID_DENSITY.includes(raw?.adaptedFor?.density)
        ? raw.adaptedFor.density
        : "standard",
    },
    identifiedMisconceptions: Array.isArray(raw?.identifiedMisconceptions)
      ? raw.identifiedMisconceptions
          .filter((m: any) => typeof m === "string")
          .slice(0, 5)
          .map((m: string) => m.slice(0, 160))
      : [],
    scenes,
  };
}

const SUBJECT_STRATEGY_GUIDE = `
Reference structures by subject (use as inspiration, adapt to the actual question — never force a mismatched structure):
- Mathematics: Concept -> Visual equation -> Worked example -> Transformation -> Practice -> Quiz
- Programming: Problem -> Visualization -> Code -> Execution trace -> Memory visualization -> Complexity -> Practice
- History: Timeline -> Map/context -> Cause -> Effect -> Comparison -> Summary
- Biology: Structure -> Labels -> Internal process -> Animation -> Summary -> Quiz
- Physics: Situation -> Diagram -> Forces -> Motion -> Calculation -> Verification
For any other subject, design an analogous structure: establish context, build the core idea, show it in action, then reinforce.`;

/**
 * Stage 1 of the two-stage Scene Generation Engine. Converts a LessonPlan
 * (+ tool context, for misconception/fact grounding only — never used to
 * pick colors/positions) into a renderer-independent ScenePlan: educational
 * intent, teaching primitives, sequencing, misconceptions, and pacing.
 *
 * This function knows nothing about SVG, canvas, colors, or coordinates.
 * Translating a ScenePlan into renderer-specific output is the job of a
 * SceneAdapter (see adapters/sceneAdapter.ts).
 */
export async function generateScenePlan(
  question: string,
  plan: LessonPlan,
  toolResults: ToolResult[],
): Promise<{ scenePlan: ScenePlan; usage?: GroqUsage }> {
  const toolContext = toolResults
    .filter((r) => r.success && r.summary)
    .map((r) => `[${r.tool}] ${r.summary}`)
    .join("\n");

  const isBeginner =
    plan.difficulty === "Elementary" ||
    plan.difficulty === "Middle School" ||
    plan.difficulty === "Beginner";
  const isAdvanced = plan.difficulty === "Advanced" || plan.difficulty === "University";

  const { data, usage } = await callGroqJson([
    {
      role: "system",
      content: `You are a world-class teacher, instructional designer, cognitive scientist, and animation director. You are NOT a renderer — you never think about SVG, pixels, colors, or coordinates. Your only job is deciding exactly what the student should experience, and why.

For every scene you plan, you must be able to answer:
- Why does this scene exist?
- What misconception does it solve?
- What should the learner understand after this scene?
- What kind of visual makes this easiest to understand, and why (never because it "looks good")?

Never create a decorative or filler scene. Never repeat an explanation already given. Every scene must build on what came before and prepare for what comes next — avoid isolated scenes.

Think in reusable teaching primitives (Reveal, Highlight, Compare, Transform, Trace, Pause, Question, etc), not in visual objects. Never reveal everything at once — sequence primitives so the learner's attention has a single focus at a time.
${SUBJECT_STRATEGY_GUIDE}

Adapt to the learner's level:
${isBeginner ? "- This learner is a BEGINNER: use more scenes, more analogies, more pauses, more repetition, higher visual focus, sparse pacing density." : isAdvanced ? "- This learner is ADVANCED: use fewer scenes, higher information density per scene, more interaction, less narration, dense pacing density." : "- This learner is at a STANDARD level: balance scene count and density."}

The lesson plan already decided (follow it, do not redesign the pedagogy):
- Subject: ${plan.subject}, Difficulty: ${plan.difficulty}
- Objective: ${plan.objective}
- Teaching strategy sequence: ${plan.teachingStrategy.join(" -> ")}
${plan.prerequisites.length > 0 ? `- Learner may not know: ${plan.prerequisites.join(", ")}` : ""}
- ${plan.useAnalogy ? "Include an analogy scene." : "An analogy is not necessary."}
- ${plan.useWorkedExample ? "Include one full worked example, broken into steps, no skipping." : "A worked example is not necessary."}
${plan.includeQuiz ? "- End with an Assessment-type scene posing a short quiz question." : ""}
${plan.includePractice ? "- Include a Practice-type scene near the end." : ""}
${toolContext ? `\nGrounding information already retrieved by tools (use it to identify real, accurate misconceptions and facts — do not contradict it):\n${toolContext}` : ""}

Before writing scenes, identify 1-3 real misconceptions students commonly have about this specific topic (e.g. "Students think recursion is looping", "Students think negative signs can be ignored") and design at least one scene that explicitly corrects the most important one, where relevant.

Respond with ONLY valid JSON, no markdown, no code fences, no extra text, in exactly this shape:
{
  "title": "short engaging lesson title",
  "objective": "one sentence: what the student understands after the whole lesson",
  "subjectStrategy": "which structure you used and why, one sentence",
  "adaptedFor": { "difficulty": "${plan.difficulty}", "density": "sparse" | "standard" | "dense" },
  "identifiedMisconceptions": ["misconception 1", "..."],
  "scenes": [
    {
      "id": 1,
      "type": "Explanation" | "Example" | "Practice" | "Assessment" | "Transition" | "Recap",
      "educationalIntent": "IntroduceConcept" | "RecallPriorKnowledge" | "BuildIntuition" | "ShowAnalogy" | "VisualizeProcess" | "CompareIdeas" | "TransformEquation" | "TraceExecution" | "ExplainCause" | "ExplainEffect" | "DemonstrateAlgorithm" | "BreakIntoSteps" | "CorrectMisconception" | "Summarize" | "AssessUnderstanding" | "Practice" | "Review",
      "objective": "what the learner understands after THIS scene",
      "teachingReason": "why this scene exists / what it solves",
      "narration": "one or two natural spoken sentences, no symbols (write numbers/operators as words)",
      "primitives": ["Write", "Highlight"],
      "visualFocus": { "type": "Equation" | "Graph" | "Table" | "Diagram" | "Flowchart" | "Timeline" | "CodeTrace" | "Shape" | "Chart" | "ArrayOrStack" | "Icon" | "Comparison" | "None", "purpose": "why this visual reduces cognitive load", "focusSubject": "short label of the specific thing depicted" },
      "importance": "core" | "supporting" | "optional",
      "duration": 6,
      "revealSteps": 2,
      "interactionType": "None" | "WaitForContinue" | "PromptQuestion" | "RevealOnDemand",
      "cameraFocus": "wide" | "focused" | "detail",
      "prerequisiteReference": null,
      "preparesForSceneId": null,
      "misconceptionsAddressed": [{ "misconception": "...", "correction": "..." }],
      "transition": "one sentence bridging from the previous scene (empty string for scene 1)"
    }
  ]
}

Rules:
- Generate 4 to 8 scenes (fewer if density is "dense", more if "sparse").
- "prerequisiteReference" must reference an EARLIER scene id or be null. "preparesForSceneId" must reference a LATER scene id or be null.
- Output ONLY the JSON object.`,
    },
    { role: "user", content: question },
  ]);

  return { scenePlan: sanitizeScenePlan(data ?? {}), usage };
}
