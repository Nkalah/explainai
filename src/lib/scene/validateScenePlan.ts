import type { ScenePlan } from "./scenePlan";

export type ScenePlanIssueCode =
  | "EMPTY_PLAN"
  | "DUPLICATE_SCENE"
  | "MISSING_OBJECTIVE"
  | "MISSING_PREREQUISITE"
  | "MISSING_TRANSITION"
  | "REPEATED_NARRATION"
  | "MISSING_VISUAL_FOCUS"
  | "IMPOSSIBLE_ORDER";

export interface ScenePlanValidationIssue {
  code: ScenePlanIssueCode;
  severity: "warning" | "error";
  message: string;
  sceneId?: number;
}

/**
 * Structural validation only — this never judges pedagogical quality (that's
 * the LLM's job in generateScenePlan.ts), only internal consistency: does
 * the plan reference scenes that exist, is anything obviously duplicated or
 * missing. Only EMPTY_PLAN is treated as fatal by callers; everything else
 * is a warning surfaced to the developer via the Execution Inspector.
 */
export function validateScenePlan(plan: ScenePlan): ScenePlanValidationIssue[] {
  const issues: ScenePlanValidationIssue[] = [];

  if (plan.scenes.length === 0) {
    issues.push({ code: "EMPTY_PLAN", severity: "error", message: "Scene plan contains no scenes." });
    return issues;
  }

  const seenNarration = new Map<string, number>();
  const seenObjective = new Map<string, number>();
  const idsInPlan = new Set(plan.scenes.map((s) => s.id));

  plan.scenes.forEach((scene, index) => {
    if (!scene.objective.trim()) {
      issues.push({
        code: "MISSING_OBJECTIVE",
        severity: "warning",
        message: `Scene ${scene.id} has no objective — unclear what the learner should take away.`,
        sceneId: scene.id,
      });
    }

    if (index > 0 && !scene.transition.trim()) {
      issues.push({
        code: "MISSING_TRANSITION",
        severity: "warning",
        message: `Scene ${scene.id} has no transition from the previous scene.`,
        sceneId: scene.id,
      });
    }

    if (scene.visualFocus.type !== "None" && !scene.visualFocus.focusSubject.trim()) {
      issues.push({
        code: "MISSING_VISUAL_FOCUS",
        severity: "warning",
        message: `Scene ${scene.id} declares a "${scene.visualFocus.type}" visual but no focus subject.`,
        sceneId: scene.id,
      });
    }

    if (scene.prerequisiteReference != null) {
      if (scene.prerequisiteReference >= scene.id || !idsInPlan.has(scene.prerequisiteReference)) {
        issues.push({
          code: "IMPOSSIBLE_ORDER",
          severity: "error",
          message: `Scene ${scene.id} references prerequisite scene ${scene.prerequisiteReference}, which doesn't precede it or doesn't exist.`,
          sceneId: scene.id,
        });
      }
    }

    if (scene.preparesForSceneId != null) {
      if (scene.preparesForSceneId <= scene.id || !idsInPlan.has(scene.preparesForSceneId)) {
        issues.push({
          code: "IMPOSSIBLE_ORDER",
          severity: "error",
          message: `Scene ${scene.id} claims to prepare for scene ${scene.preparesForSceneId}, which doesn't follow it or doesn't exist.`,
          sceneId: scene.id,
        });
      }
    }

    const narrationKey = scene.narration.trim().toLowerCase();
    if (narrationKey) {
      const priorId = seenNarration.get(narrationKey);
      if (priorId != null) {
        issues.push({
          code: "REPEATED_NARRATION",
          severity: "warning",
          message: `Scene ${scene.id} repeats the exact narration from scene ${priorId}.`,
          sceneId: scene.id,
        });
      } else {
        seenNarration.set(narrationKey, scene.id);
      }
    }

    const objectiveKey = scene.objective.trim().toLowerCase();
    if (objectiveKey) {
      const priorId = seenObjective.get(objectiveKey);
      if (priorId != null) {
        issues.push({
          code: "DUPLICATE_SCENE",
          severity: "warning",
          message: `Scene ${scene.id} has the same objective as scene ${priorId} — likely redundant.`,
          sceneId: scene.id,
        });
      } else {
        seenObjective.set(objectiveKey, scene.id);
      }
    }
  });

  return issues;
}
