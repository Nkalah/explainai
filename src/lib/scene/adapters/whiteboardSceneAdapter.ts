import type { EngineLesson, Scene, VisualStrategy } from "../../engineTypes";
import type { LessonPlan } from "../../lessonPlan";
import type { ToolResult } from "../../tools/types";
import type { ScenePlan, PlannedScene } from "../scenePlan";
import type {
  AdapterConfidence,
  AdapterSource,
  SceneAdapter,
  SceneAdapterResult,
} from "./sceneAdapter";
import {
  sanitizeEngineScene,
  VALID_ANIMATION_TYPES,
  VALID_OBJECT_TYPES,
  VALID_VISUAL_STRATEGIES,
} from "./sanitizeEngineScene";

import { callGroqJson } from "../../groqClient";
import { generateSceneImage } from "../../imageGeneration";

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function pickVisualStrategy(planned: PlannedScene, plan: LessonPlan): { strategy: VisualStrategy; reason: string } {
  const vf = planned.visualFocus.type;
  const subject = plan.subject.toLowerCase();

  if (["Graph", "Chart", "Table", "ArrayOrStack", "CodeTrace", "Equation"].includes(vf)) {
    return { strategy: "whiteboard-only", reason: "Precise whiteboard rendering is clearer than a photograph for structured data." };
  }
  if (["Diagram", "Flowchart", "Timeline"].includes(vf)) {
    return { strategy: "image-annotation", reason: "Diagram benefits from a base illustration with callout annotations." };
  }
  if (vf === "Comparison") {
    return { strategy: "comparison", reason: "Split-screen comparison helps learners see differences at a glance." };
  }
  if (["Biology", "Chemistry", "Physics", "Anatomy", "Geography"].some(s => subject.includes(s))) {
    return { strategy: "image-primary", reason: "Scientific subjects benefit from realistic illustrations." };
  }
  if (["History", "Art", "Architecture"].some(s => subject.includes(s))) {
    return { strategy: "image-primary", reason: "Humanities subjects benefit from contextual visuals." };
  }
  if (planned.type === "Explanation" && planned.revealSteps > 2) {
    return { strategy: "diagram-overlay", reason: "Complex explanation needs progressive visual layers." };
  }
  return { strategy: "whiteboard-only", reason: "Default to clean whiteboard rendering for abstract concepts." };
}

function buildImageStrategyHint(strategy: VisualStrategy): string {
  const hints: Record<VisualStrategy, string> = {
    "whiteboard-only": "No image needed — use clean whiteboard text/shapes/graphs only.",
    "image-primary": "Include a primary educational image showing the main concept. Add 1-2 whiteboard annotations (arrows, labels, highlights) on top.",
    "image-annotation": "Generate a base educational image, then overlay 2-4 annotations (arrows pointing to key parts, labels, highlight circles) that reveal progressively.",
    "diagram-overlay": "Use a subtle grid/diagram background image with whiteboard elements drawn on top for progressive explanation.",
    "comparison": "Generate a comparison image (before/after, left/right, or Venn-style) with whiteboard labels highlighting differences.",
  };
  return hints[strategy];
}

/**
 * Stage 2 of the two-stage Scene Generation Engine. Takes the pedagogical
 * ScenePlan (Stage 1) and translates it into the concrete Scene/SceneObject
 * structures LessonEngine.tsx already knows how to render: percentage
 * positions, colors, animation types, camera moves.
 *
 * This is where "renderer-specific" decisions get made — everything the
 * ScenePlan deliberately left abstract (visualFocus.type -> which concrete
 * ObjectType and layout, primitives -> which animation.type) gets resolved
 * here. A future CanvasSceneAdapter/VRSceneAdapter would make different
 * decisions from the SAME ScenePlan input without touching Stage 1 at all.
 */
export class WhiteboardSceneAdapter implements SceneAdapter {
  readonly name = "WhiteboardSceneAdapter";

  async adapt(
    question: string,
    plan: LessonPlan,
    scenePlan: ScenePlan,
    toolResults: ToolResult[],
  ): Promise<SceneAdapterResult> {
    const successfulResults = toolResults.filter((r) => r.success && r.summary);
    const groundingToolRan = successfulResults.some(
      (r) => r.tool === "TrustedSourcesRetriever" || r.tool === "SearchEngine",
    );
    const groundingToolFoundNothing =
      toolResults.some((r) => r.tool === "TrustedSourcesRetriever" || r.tool === "SearchEngine") &&
      !groundingToolRan;
    const failedRequired = toolResults.filter(
      (r) => !r.success && !r.error?.includes("not yet implemented"),
    );

    const referenceBlock =
      successfulResults.length > 0
        ? `\n\nThe following tools were run before this lesson and returned real information. Use it — do not contradict, re-derive, or ignore it. If a tool provides a "sources" field, only cite sources from there (use their exact title and url) — never invent a source:\n\n` +
          successfulResults.map((r) => `[${r.tool}]\n${r.summary}`).join("\n\n")
        : "";

    const confidenceGuidance = groundingToolRan
      ? `Grounding information was retrieved above by trusted tools. Base the lesson on it. Set "confidence" to "High" or "Medium" depending on how well it's supported, explaining why in "confidenceReason". List only the specific sources actually provided above in "sources" — never invent one.`
      : groundingToolFoundNothing
        ? `A grounding tool was run but found no useful results. Set "confidence" to "Low", explain in "confidenceReason" that no sources were found, and set "sources" to an empty array.`
        : failedRequired.length > 0
          ? `Some tools failed to run. Set "confidence" to "Medium", explain in "confidenceReason" that supporting tools were unavailable, and set "sources" to an empty array.`
          : `This is stable, well-established knowledge that didn't require grounding tools. Set "confidence" to "High" and "confidenceReason" to something like "Well-established, stable knowledge that doesn't change over time."`;

    const scenePlanBlock = scenePlan.scenes
      .map((s) => {
        const strategy = pickVisualStrategy(s, plan);
        const parts = [
          `Scene ${s.id} (${s.type}, importance: ${s.importance}, camera: ${s.cameraFocus})`,
          `  Educational intent: ${s.educationalIntent}`,
          `  Objective: ${s.objective}`,
          `  Narration to use (word-for-word, do not rewrite): "${s.narration}"`,
          `  Teaching primitives to express, in order: ${s.primitives.join(" -> ")}`,
          `  Visual focus: ${s.visualFocus.type} — depict "${s.visualFocus.focusSubject}" (${s.visualFocus.purpose})`,
          `  Reveal steps: ${s.revealSteps} (stagger object animation "start" times across the scene's duration to match)`,
          `  Interaction: ${s.interactionType === "None" ? "no pause" : s.interactionType}`,
          `  Suggested duration: ${s.duration}s`,
          `  Recommended visual strategy: ${strategy.strategy} — ${strategy.reason}`,
          `  Visual strategy hint: ${buildImageStrategyHint(strategy.strategy)}`,
        ];
        if (s.misconceptionsAddressed.length > 0) {
          parts.push(
            `  Misconceptions to correct: ${s.misconceptionsAddressed.map((m) => `"${m.misconception}" -> ${m.correction}`).join("; ")}`,
          );
        }
        return parts.join("\n");
      })
      .join("\n\n");

    const { data, usage } = await callGroqJson([
      {
        role: "system",
        content: `You are an animation director translating an approved lesson plan into an animated whiteboard rendering. A curriculum planner and scene planner have ALREADY decided the pedagogy, sequencing, narration, and what each scene should teach — your ONLY job is choosing how to draw each scene: concrete positions, object types, animations, and whether to include a generated educational image.

Today's date is ${today()}. If a question involves the current date, day, or year, use this directly.
${referenceBlock}

${confidenceGuidance}

You are designing SCENES made of OBJECTS positioned on a canvas using PERCENTAGE coordinates (0 to 100 for both x and y; 0,0 is top-left, 100,100 is bottom-right, 50,50 is center).

VISUAL STRATEGY SELECTION:
For each scene, choose the BEST visual strategy based on the scene plan's recommended visual strategy:
- "whiteboard-only": Use equations, graphs, shapes, text. NO image field.
- "image-primary": Include a generated educational image. Add 1-2 whiteboard annotations.
- "image-annotation": Include a base image. Add 2-4 progressive annotations (arrows, labels, highlights).
- "diagram-overlay": Include a subtle diagram background image. Draw whiteboard elements on top for progressive explanation.
- "comparison": Generate a comparison image (before/after or side-by-side). Add comparison labels.

IMAGE QUALITY RULES:
- Every image must be SPECIFIC to the scene's content, not generic.
- Image prompts must describe: exact subject, key objects, composition, educational purpose, visual style, perspective, and required diagram elements.
- Avoid: random people, watermarks, cluttered scenes, unrelated decorations, broken text.
- For math/physics: focus on equations, graphs, diagrams — do NOT use random stock photos.
- For biology/chemistry: use labeled scientific diagrams, not generic photos.
- For history: use timelines, maps, or comparison visuals.

The approved scene plan, in order — follow it exactly, one output scene per input scene, same ids:
${scenePlanBlock}

Respond with ONLY valid JSON, no markdown, no code fences, no extra text, in exactly this shape:
{
  "scenes": [
    {
      "id": 1,
      "title": "short scene title",
      "duration": 6,
      "camera": { "zoom": 1, "panX": 0, "panY": 0 },
      "narration": "must match the scene plan's narration for this id exactly",
      "transcript": "same as narration, written form",
      "waitForUser": false,
      "visualStrategy": "whiteboard-only",
      "learningGoal": "what the learner understands after this scene",
      "transition": "bridge to next scene (empty for scene 1)",
      "image": null,
      "annotations": [],
      "objects": [
        {
          "id": "eq1",
          "type": "equation",
          "position": { "x": 50, "y": 40 },
          "text": "3x + 7 = 22",
          "color": "foreground",
          "animation": { "type": "write", "start": 0, "duration": 1 }
        }
      ]
    }
  ],
  "sources": [{ "title": "...", "url": "..." }],
  "confidence": "High",
  "confidenceReason": "..."
}

Image field structure (include ONLY when visualStrategy is NOT "whiteboard-only"):
"image": {
  "prompt": "detailed specific educational prompt describing exactly what to draw",
  "alt": "short description of the image",
  "source": "generated-svg",
  "strategy": "image-annotation"
}

Annotations structure (include ONLY for image-annotation or image-primary strategies):
"annotations": [
  {
    "id": "ann1",
    "type": "arrow",
    "position": { "x": 30, "y": 50 },
    "targetPosition": { "x": 60, "y": 50 },
    "text": "points to key element",
    "color": "brand",
    "animation": { "type": "fadeIn", "start": 1.5, "duration": 0.5 }
  }
]

Annotation types: "arrow" (with targetPosition), "label" (with text), "highlight" (no text, just a box), "circle" (no text), "callout" (with text).

Object types, use the one that best matches each scene's visualFocus.type — do not force a visual where plain text works fine:
- "text" / "label": short text, needs "text".
- "equation": a math equation on the board, needs "text" (plain characters, no LaTeX).
- "code": a short code snippet, needs "text" (can include newlines).
- "rectangle" / "circle" / "triangle" / "line" / "arrow" / "doubleArrow": simple shapes, use "width"/"height" for size (percentage).
- "graph" / "scatterPlot": needs "points": [{ "x": number, "y": number }, ...] (5-20 points).
- "barChart": needs "bars": [{ "label": "...", "value": number }, ...].
- "pieChart": needs "slices": [{ "label": "...", "value": number }, ...].
- "table": needs "headers": ["..."] and "rows": [["...", "..."], ...].
- "array" / "stack": needs "values": [number or short string, ...] (stack: first value is the bottom).
- "highlightBox": empty rectangle used to circle/highlight something already on screen.
- "callout": a short side note, needs "text".
- "icon": needs "iconName" (a lucide-react icon name like "Lightbulb", "ArrowRight", "Check").

Rules:
- Each scene should have 1 to 4 objects (don't overcrowd). Images count as one object.
- "camera.zoom" between 0.8 and 1.6, "panX"/"panY" between -20 and 20, matching each scene's requested cameraFocus (wide -> zoom near 1, focused -> ~1.2-1.4, detail -> ~1.4-1.6 with pan toward the visual focus).
- "animation.type" must be exactly one of: ${VALID_ANIMATION_TYPES.join(", ")}. Translate each scene's teaching primitives into animations in order: Write/Reveal -> write or fadeIn, Highlight/Focus -> highlight, Circle -> circle, Transform -> replace-equivalent via a second object or reveal, Compare/Split -> slideLeft/slideRight, Trace/Move -> move, final answer -> pulse, diagram/shape forming -> draw.
- Stagger "animation.start" across objects in a scene to express the scene's reveal steps in order — don't reveal everything at start:0.
- For annotations, stagger their start times AFTER the base image fades in (start: 0.8+).
- "waitForUser" true only when the scene plan's interactionType is "WaitForContinue" or "PromptQuestion".
- Valid object types: ${VALID_OBJECT_TYPES.join(", ")}.
- Valid visual strategies: ${VALID_VISUAL_STRATEGIES.join(", ")}.
- Output ONLY the JSON object.`,
      },
      { role: "user", content: question },
    ]);

    const scenes: Scene[] = (Array.isArray(data?.scenes) ? data.scenes : [])
      .map((s: any, i: number) => sanitizeEngineScene(s, i))
      .filter((s: Scene | null): s is Scene => s !== null);

    const plannedScenes = scenePlan.scenes;
    const scenesWithImages: Scene[] = await Promise.all(
      scenes.map(async (scene, i) => {
        const planned = plannedScenes.find((ps) => ps.id === scene.id) ?? plannedScenes[i];
        if (!planned) return scene;

        const strategy = pickVisualStrategy(planned, plan);
        const isImageScene = !["whiteboard-only"].includes(strategy.strategy);

        if (isImageScene && !scene.image) {
          try {
            const generatedImage = await generateSceneImage(
              plan.subject,
              scene.title,
              scene.narration,
              planned.visualFocus.focusSubject,
              strategy.strategy,
            );
            return { ...scene, image: generatedImage, visualStrategy: strategy.strategy };
          } catch {
            return { ...scene, visualStrategy: strategy.strategy };
          }
        }

        return { ...scene, visualStrategy: scene.visualStrategy ?? strategy.strategy };
      }),
    );

    const sources: AdapterSource[] = Array.isArray(data?.sources)
      ? data.sources
          .filter((s: any) => typeof s?.title === "string" && typeof s?.url === "string")
          .slice(0, 5)
      : [];

    const confidence: AdapterConfidence =
      data?.confidence === "High" || data?.confidence === "Medium" || data?.confidence === "Low"
        ? data.confidence
        : "Medium";

    const lesson: EngineLesson = {
      title: scenePlan.title,
      objective: scenePlan.objective,
      scenes: scenesWithImages,
    };

    return {
      adapted: {
        lesson,
        sources,
        confidence,
        confidenceReason: typeof data?.confidenceReason === "string" ? data.confidenceReason : "",
      },
      usage,
    };
  }
}

export const whiteboardSceneAdapter = new WhiteboardSceneAdapter();
