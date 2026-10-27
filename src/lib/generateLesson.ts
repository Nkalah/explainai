import { createServerFn } from "@tanstack/react-start";
import type { EngineLesson } from "./engineTypes";
import { generateLessonPlan } from "./generateLessonPlan";
import type { LessonPlan } from "./lessonPlan";
import { registerAllTools } from "./tools/registerAllTools";
import { toolRouter } from "./tools/router";
import { toolRegistry } from "./tools/registry";
import type { ToolResult } from "./tools/types";
import { generateScenePlan } from "./scene/generateScenePlan";
import { validateScenePlan } from "./scene/validateScenePlan";
import { whiteboardSceneAdapter } from "./scene/adapters/whiteboardSceneAdapter";
import { createExecutionInspector } from "./execution/inspector";
import { recordExecutionReport } from "./execution/store";
import type {
  RouterSection,
  SearchSection,
  ToolDecisionTrace,
  ToolExecution,
} from "./execution/types";
import { z } from "zod";

const isDev = process.env.NODE_ENV !== "production";

const LessonInputSchema = z.object({
  question: z.string().min(1, "Question is required").max(2000, "Question is too long"),
});

export type LessonSource = { title: string; url: string };

export type LessonResult = EngineLesson & {
  sources: LessonSource[];
  confidence: "High" | "Medium" | "Low";
  confidenceReason: string;
  plan: LessonPlan;
};

function objectTypeCounts(lesson: EngineLesson): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const scene of lesson.scenes) {
    for (const obj of scene.objects) {
      counts[obj.type] = (counts[obj.type] ?? 0) + 1;
    }
  }
  return counts;
}

const DIAGRAM_TYPES = new Set([
  "graph",
  "barChart",
  "pieChart",
  "scatterPlot",
  "table",
  "array",
  "stack",
]);

export const generateLesson = createServerFn({ method: "POST" })
  .validator((data: unknown) => LessonInputSchema.parse(data))
  .handler(async ({ data }): Promise<LessonResult> => {
    const inspector = isDev ? createExecutionInspector(data.question) : null;

    // --- Planner ---
    const plannerStart = Date.now();
    const { plan, usage: plannerUsage } = await generateLessonPlan(data.question);
    const plannerEnd = Date.now();
    inspector?.recordPlanner({
      subject: plan.subject,
      difficulty: plan.difficulty,
      objective: plan.objective,
      prerequisites: plan.prerequisites,
      teachingStrategy: plan.teachingStrategy,
      recommendedVisuals: plan.recommendedVisuals,
      confidence: plan.confidence,
      confidenceReason: plan.confidenceReason,
      planningNotes: plan.planningNotes,
      tokensUsed: plannerUsage?.total_tokens,
      startedAt: plannerStart,
      endedAt: plannerEnd,
      durationMs: plannerEnd - plannerStart,
    });

    // --- Router (decide + execute) ---
    registerAllTools();
    const routerStart = Date.now();
    const decisions = await toolRouter.decide(data.question, plan);
    const toolResults: ToolResult[] = await toolRouter.route(data.question, plan);
    const routerEnd = Date.now();

    if (inspector) {
      const allTools: ToolDecisionTrace[] = decisions.map((d) => {
        // priority/canRunInParallel/implemented live on the registered Tool's
        // metadata, not on RoutingDecision itself — look them up for tools
        // that are actually registered (unimplemented/never-registered tools
        // like Wikipedia fall back to sane defaults).
        const meta = toolRegistry.get(d.tool)?.metadata;
        return {
          tool: d.tool,
          shouldRun: d.shouldRun,
          routingConfidence: d.confidence,
          reason: d.reason,
          priority: meta?.priority ?? 0,
          canRunInParallel: meta?.canRunInParallel ?? false,
          implemented: meta?.implemented ?? false,
        };
      });

      const selectedTools = decisions.filter((d) => d.shouldRun).map((d) => d.tool);
      const skippedTools = decisions
        .filter((d) => !d.shouldRun)
        .map((d) => ({ tool: d.tool, reason: d.reason }));

      const routerSection: RouterSection = {
        allTools,
        selectedTools,
        skippedTools,
        startedAt: routerStart,
        endedAt: routerEnd,
        durationMs: routerEnd - routerStart,
      };
      inspector.recordRouter(routerSection);

      for (const decision of decisions) {
        if (!decision.shouldRun) continue;
        const result = toolResults.find((r) => r.tool === decision.tool);
        if (!result) {
          inspector.warn({
            code: "MISSING_TOOL",
            message: `Router selected "${decision.tool}" to run but no ToolResult was returned for it.`,
            severity: "warning",
            stage: "router",
            detail: { tool: decision.tool },
          });
          continue;
        }
        const canRunInParallel =
          toolRegistry.get(decision.tool)?.metadata.canRunInParallel ?? false;
        const execution: ToolExecution = {
          tool: result.tool,
          success: result.success,
          routingConfidence: decision.confidence,
          warnings: [],
          error: result.error,
          retryAttempts: 0, // router.ts has no retry logic today — reported honestly, not fabricated.
          fallbackUsed: false, // router.ts has no fallback-substitution logic today.
          executionMode: canRunInParallel ? "parallel" : "sequential",
          startedAt: routerStart,
          endedAt: routerStart + (result.durationMs ?? 0),
          durationMs: result.durationMs ?? 0,
          summaryPreview: result.summary?.slice(0, 160),
        };
        inspector.recordTool(execution);
      }

      const searchResult = toolResults.find((r) => r.tool === "SearchEngine");
      const searchDecision = decisions.find((d) => d.tool === "SearchEngine");
      if (searchDecision) {
        const searchSection: SearchSection = {
          tool: "SearchEngine",
          used: searchDecision.shouldRun,
          reason: searchDecision.reason,
          query: data.question,
          resultCount: Array.isArray(searchResult?.data) ? searchResult.data.length : 0,
          sourcesSelected: Array.isArray(searchResult?.data)
            ? (searchResult.data as any[])
                .filter((s) => typeof s?.title === "string" && typeof s?.url === "string")
                .map((s) => ({ title: s.title, url: s.url }))
            : [],
          sourcesRejected: 0, // SearchEngine doesn't filter/reject candidates today — see execution/types.ts note.
          durationMs: searchResult?.durationMs ?? 0,
        };
        inspector.recordSearch(searchSection);
      }
    }

    // --- Stage 1: renderer-independent Scene Plan ---
    const scenePlanningStart = Date.now();
    const { scenePlan, usage: scenePlanUsage } = await generateScenePlan(
      data.question,
      plan,
      toolResults,
    );
    const validationIssues = validateScenePlan(scenePlan);
    const scenePlanningEnd = Date.now();

    inspector?.recordScenePlanning({
      subjectStrategy: scenePlan.subjectStrategy,
      density: scenePlan.adaptedFor.density,
      sceneCount: scenePlan.scenes.length,
      identifiedMisconceptions: scenePlan.identifiedMisconceptions,
      validationIssues,
      tokensUsed: scenePlanUsage?.total_tokens,
      startedAt: scenePlanningStart,
      endedAt: scenePlanningEnd,
      durationMs: scenePlanningEnd - scenePlanningStart,
    });

    if (validationIssues.some((i) => i.severity === "error")) {
      throw new Error(
        `Scene plan failed validation: ${validationIssues
          .filter((i) => i.severity === "error")
          .map((i) => i.message)
          .join("; ")}`,
      );
    }

    // --- Stage 2: adapt the Scene Plan into renderer-specific content ---
    const adapterStart = Date.now();
    const { adapted, usage: adapterUsage } = await whiteboardSceneAdapter.adapt(
      data.question,
      plan,
      scenePlan,
      toolResults,
    );
    const adapterEnd = Date.now();

    if (adapted.lesson.scenes.length === 0) {
      throw new Error("The lesson came back empty. Try asking again.");
    }

    const narrationCharacterCount = adapted.lesson.scenes.reduce(
      (sum, s) => sum + s.narration.length,
      0,
    );
    const animationCount = adapted.lesson.scenes.reduce((sum, s) => sum + s.objects.length, 0);
    const typeCounts = objectTypeCounts(adapted.lesson);
    const diagramCount = Object.entries(typeCounts)
      .filter(([type]) => DIAGRAM_TYPES.has(type))
      .reduce((sum, [, count]) => sum + count, 0);

    inspector?.recordGeneration({
      adapterName: whiteboardSceneAdapter.name,
      sceneCount: adapted.lesson.scenes.length,
      scenesDropped: Math.max(0, scenePlan.scenes.length - adapted.lesson.scenes.length),
      sceneObjectTypeCounts: typeCounts,
      narrationCharacterCount,
      animationCount,
      diagramCount,
      confidence: adapted.confidence,
      confidenceReason: adapted.confidenceReason,
      tokensUsed: adapterUsage?.total_tokens,
      startedAt: adapterStart,
      endedAt: adapterEnd,
      durationMs: adapterEnd - adapterStart,
    });

    // --- Render prep (trivial today — result is already renderer-ready) ---
    const renderPrepStart = Date.now();
    const result: LessonResult = {
      title: adapted.lesson.title,
      objective: adapted.lesson.objective,
      scenes: adapted.lesson.scenes,
      sources: adapted.sources,
      confidence: adapted.confidence,
      confidenceReason: adapted.confidenceReason,
      plan,
    };
    inspector?.recordRenderPrep(Date.now() - renderPrepStart);

    if (inspector) {
      recordExecutionReport(inspector.finish());
    }

    return result;
  });
