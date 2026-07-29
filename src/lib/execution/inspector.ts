import type {
  ExecutionInspector,
  ExecutionReport,
  ExecutionStage,
  ExecutionStatus,
  ExecutionTrace,
  GenerationSection,
  PerformanceMetrics,
  PlannerSection,
  RouterSection,
  ScenePlanningSection,
  SearchSection,
  ToolExecution,
  WarningEvent,
} from "./types";

// Tunable thresholds — centralized here so "what counts as slow/low-confidence"
// is a single edit, not scattered magic numbers.
const SLOW_STAGE_THRESHOLD_MS = 3000;
const HIGH_LATENCY_TOTAL_MS = 8000;
const LOW_CONFIDENCE_THRESHOLD = 0.4;
const TOKEN_WARNING_THRESHOLD = 6000;

const FALLBACK_PLANNER: PlannerSection = {
  subject: "unknown",
  difficulty: "unknown",
  objective: "",
  prerequisites: [],
  teachingStrategy: [],
  recommendedVisuals: [],
  confidence: 0,
  confidenceReason: "Planner did not complete before the request ended.",
  planningNotes: "",
  startedAt: 0,
  endedAt: 0,
  durationMs: 0,
};

const FALLBACK_ROUTER: RouterSection = {
  allTools: [],
  selectedTools: [],
  skippedTools: [],
  startedAt: 0,
  endedAt: 0,
  durationMs: 0,
};

const FALLBACK_SCENE_PLANNING: ScenePlanningSection = {
  subjectStrategy: "",
  density: "unknown",
  sceneCount: 0,
  identifiedMisconceptions: [],
  validationIssues: [],
  startedAt: 0,
  endedAt: 0,
  durationMs: 0,
};

const FALLBACK_GENERATION: GenerationSection = {
  adapterName: "unknown",
  sceneCount: 0,
  scenesDropped: 0,
  sceneObjectTypeCounts: {},
  narrationCharacterCount: 0,
  animationCount: 0,
  diagramCount: 0,
  confidence: "Low",
  confidenceReason: "Generation did not complete before the request ended.",
  startedAt: 0,
  endedAt: 0,
  durationMs: 0,
};

let counter = 0;
function nextId(): string {
  counter += 1;
  return `trace_${Date.now()}_${counter}`;
}

class DefaultExecutionInspector implements ExecutionInspector {
  private trace: ExecutionTrace;

  constructor(question: string) {
    this.trace = {
      id: nextId(),
      question,
      startedAt: Date.now(),
      stages: [],
      tools: [],
      search: null,
      warnings: [],
    };
  }

  private pushStage(name: ExecutionStage["name"], status: ExecutionStatus, durationMs: number) {
    this.trace.stages.push({ name, status, durationMs });
    if (durationMs > SLOW_STAGE_THRESHOLD_MS) {
      this.warn({
        code: "HIGH_LATENCY",
        message: `Stage "${name}" took ${durationMs}ms, above the ${SLOW_STAGE_THRESHOLD_MS}ms threshold.`,
        severity: "warning",
        stage: name === "tools" ? "tool" : (name as WarningEvent["stage"]),
      });
    }
  }

  recordPlanner(section: PlannerSection) {
    this.trace.planner = section;
    const status: ExecutionStatus = section.confidence < LOW_CONFIDENCE_THRESHOLD ? "warning" : "success";
    this.pushStage("planner", status, section.durationMs);
    if (section.confidence < LOW_CONFIDENCE_THRESHOLD) {
      this.warn({
        code: "PLANNER_LOW_CONFIDENCE",
        message: `Planner confidence (${section.confidence.toFixed(2)}) is below the ${LOW_CONFIDENCE_THRESHOLD} threshold.`,
        severity: "warning",
        stage: "planner",
      });
    }
  }

  recordRouter(section: RouterSection) {
    this.trace.router = section;
    this.pushStage("router", "success", section.durationMs);
  }

  recordTool(execution: ToolExecution) {
    this.trace.tools.push(execution);
    if (!execution.success) {
      this.warn({
        code: "TOOL_FAILED",
        message: `Tool "${execution.tool}" failed: ${execution.error ?? "no error message returned"}.`,
        severity: "error",
        stage: "tool",
        detail: { tool: execution.tool },
      });
    }
    if (execution.durationMs > SLOW_STAGE_THRESHOLD_MS) {
      this.warn({
        code: "HIGH_LATENCY",
        message: `Tool "${execution.tool}" took ${execution.durationMs}ms.`,
        severity: "warning",
        stage: "tool",
        detail: { tool: execution.tool },
      });
    }
  }

  recordSearch(section: SearchSection) {
    this.trace.search = section;
    if (section.used && section.resultCount === 0) {
      this.warn({
        code: "SEARCH_NO_RESULTS",
        message: `${section.tool} ran (query: "${section.query}") but returned no results.`,
        severity: "warning",
        stage: "search",
      });
    }
  }

  recordScenePlanning(section: ScenePlanningSection) {
    this.trace.scenePlanning = section;
    const hasErrorIssue = section.validationIssues.some((i) => i.severity === "error");
    this.pushStage("scenePlanning", hasErrorIssue ? "error" : "success", section.durationMs);
    if (hasErrorIssue) {
      const errorIssues = section.validationIssues.filter((i) => i.severity === "error");
      this.warn({
        code: "SCENE_PLAN_INVALID",
        message: `Scene plan failed validation: ${errorIssues.map((i) => i.message).join("; ")}`,
        severity: "error",
        stage: "scenePlanning",
      });
    }
    for (const issue of section.validationIssues.filter((i) => i.severity === "warning")) {
      this.warn({
        code: "SCENE_PLAN_INVALID",
        message: issue.message,
        severity: "warning",
        stage: "scenePlanning",
        detail: issue.sceneId != null ? { sceneId: issue.sceneId, code: issue.code } : { code: issue.code },
      });
    }
  }

  recordGeneration(section: GenerationSection) {
    this.trace.generation = section;
    const status: ExecutionStatus = section.confidence === "Low" ? "warning" : "success";
    this.pushStage("generation", status, section.durationMs);
    if (section.confidence === "Low") {
      this.warn({
        code: "GENERATION_LOW_CONFIDENCE",
        message: `Lesson generation confidence is Low: ${section.confidenceReason}`,
        severity: "warning",
        stage: "generation",
      });
    }
  }

  recordRenderPrep(durationMs: number, status: ExecutionStatus = "success") {
    this.pushStage("renderPrep", status, durationMs);
  }

  warn(event: WarningEvent) {
    this.trace.warnings.push(event);
  }

  finish(): ExecutionReport {
    const endedAt = Date.now();
    const totalDurationMs = endedAt - this.trace.startedAt;

    const planner = this.trace.planner ?? FALLBACK_PLANNER;
    const router = this.trace.router ?? FALLBACK_ROUTER;
    const scenePlanning = this.trace.scenePlanning ?? FALLBACK_SCENE_PLANNING;
    const generation = this.trace.generation ?? FALLBACK_GENERATION;

    const plannerTokens = planner.tokensUsed;
    const scenePlanningTokens = scenePlanning.tokensUsed;
    const generationTokens = generation.tokensUsed;
    const totalTokens =
      plannerTokens != null || scenePlanningTokens != null || generationTokens != null
        ? (plannerTokens ?? 0) + (scenePlanningTokens ?? 0) + (generationTokens ?? 0)
        : undefined;

    const performance: PerformanceMetrics = {
      plannerMs: planner.durationMs,
      routerMs: router.durationMs,
      searchMs: this.trace.search?.durationMs ?? 0,
      toolExecutionMs:
        this.trace.stages.find((s) => s.name === "tools")?.durationMs ??
        this.trace.tools.reduce((sum, t) => sum + t.durationMs, 0),
      scenePlanningMs: scenePlanning.durationMs,
      lessonGenerationMs: generation.durationMs,
      renderPrepMs: this.trace.stages.find((s) => s.name === "renderPrep")?.durationMs ?? 0,
      totalMs: totalDurationMs,
      slowestStage: [...this.trace.stages].sort((a, b) => b.durationMs - a.durationMs)[0]?.name ?? "none",
      plannerTokens,
      generationTokens,
      totalTokens,
    };

    if (totalDurationMs > HIGH_LATENCY_TOTAL_MS) {
      this.warn({
        code: "HIGH_LATENCY",
        message: `Total request time (${totalDurationMs}ms) exceeded the ${HIGH_LATENCY_TOTAL_MS}ms threshold.`,
        severity: "warning",
        stage: "performance",
      });
    }

    if (totalTokens != null && totalTokens > TOKEN_WARNING_THRESHOLD) {
      this.warn({
        code: "EXCESSIVE_TOKEN_USAGE",
        message: `Total token usage (${totalTokens}) exceeded the ${TOKEN_WARNING_THRESHOLD} token threshold.`,
        severity: "warning",
        stage: "performance",
      });
    }

    return {
      id: this.trace.id,
      question: this.trace.question,
      timestamp: new Date(this.trace.startedAt).toISOString(),
      totalDurationMs,
      stages: this.trace.stages,
      planner,
      router,
      tools: this.trace.tools,
      search: this.trace.search,
      scenePlanning,
      generation,
      performance,
      warnings: this.trace.warnings,
    };
  }
}

export function createExecutionInspector(question: string): ExecutionInspector {
  return new DefaultExecutionInspector(question);
}