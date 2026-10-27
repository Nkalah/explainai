import type { EngineLesson } from "../../engineTypes";
import type { LessonPlan } from "../../lessonPlan";
import type { ToolResult } from "../../tools/types";
import type { ScenePlan } from "../scenePlan";

export type AdapterSource = { title: string; url: string };
export type AdapterConfidence = "High" | "Medium" | "Low";

export interface AdaptedLesson {
  lesson: EngineLesson;
  sources: AdapterSource[];
  confidence: AdapterConfidence;
  confidenceReason: string;
}

export type AdapterUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export interface SceneAdapterResult {
  adapted: AdaptedLesson;
  usage?: AdapterUsage;
}

/**
 * A SceneAdapter translates a renderer-independent ScenePlan (Stage 1 output)
 * into renderer-specific content (Stage 2). Today the only implementation is
 * WhiteboardSceneAdapter, which produces the existing Scene/SceneObject
 * structures from engineTypes.ts. Adding a new renderer (Canvas, native
 * video, VR) means writing a new class implementing this interface — nothing
 * upstream (the planner, router, or Scene Plan generator) needs to change.
 */
export interface SceneAdapter {
  readonly name: string;
  adapt(
    question: string,
    plan: LessonPlan,
    scenePlan: ScenePlan,
    toolResults: ToolResult[],
  ): Promise<SceneAdapterResult>;
}
