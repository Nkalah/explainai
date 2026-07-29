// Structured telemetry types for the Development Execution Inspector.
// These describe WHAT happened during a lesson request — planner decisions,
// tool routing, tool execution, search, generation, and timing — collected
// as plain data rather than parsed from console output. Dev-only; never
// retained or exposed outside development (see store.ts / serverFns.ts).

export type ExecutionStatus = "success" | "warning" | "error";

export type WarningCode =
  | "TOOL_FAILED"
  | "MISSING_TOOL"
  | "TOOL_FALLBACK_USED"
  | "SEARCH_NO_RESULTS"
  | "PLANNER_LOW_CONFIDENCE"
  | "GENERATION_LOW_CONFIDENCE"
  | "EXCESSIVE_TOKEN_USAGE"
  | "HIGH_LATENCY"
  | "SCENE_PLAN_INVALID"
  | "REQUEST_FAILED";

export interface WarningEvent {
  code: WarningCode;
  message: string;
  severity: "warning" | "error";
  stage: "planner" | "router" | "tool" | "search" | "scenePlanning" | "adapter" | "generation" | "performance";
  /** Kept to concrete primitive values (not `unknown`) — TanStack Start's
   *  server-fn serialization checker rejects `unknown`-shaped return types. */
  detail?: Record<string, string | number | boolean | null>;
}

export interface ExecutionStage {
  name: "planner" | "router" | "tools" | "search" | "scenePlanning" | "adapter" | "generation" | "renderPrep";
  status: ExecutionStatus;
  durationMs: number;
}

export interface ToolDecisionTrace {
  tool: string;
  shouldRun: boolean;
  /** The router's confidence this tool is relevant (0-1) — NOT an accuracy score. */
  routingConfidence: number;
  reason: string;
  priority: number;
  canRunInParallel: boolean;
  implemented: boolean;
}

export interface ToolExecution {
  tool: string;
  success: boolean;
  /** Carried over from the router's RoutingDecision for this tool, for convenience. */
  routingConfidence?: number;
  warnings: string[];
  error?: string;
  /** Always 0 today — router.ts has no retry logic yet. Kept honest, not fabricated. */
  retryAttempts: number;
  /** Always false today — router.ts has no fallback-substitution logic yet. */
  fallbackUsed: boolean;
  executionMode: "parallel" | "sequential";
  /** Epoch ms. Reconstructed from aggregate timing since router.ts doesn't expose
   *  per-tool absolute timestamps — see inspector.ts for how these are derived. */
  startedAt: number;
  endedAt: number;
  durationMs: number;
  summaryPreview?: string;
}

export interface PlannerSection {
  subject: string;
  difficulty: string;
  objective: string;
  prerequisites: string[];
  teachingStrategy: string[];
  recommendedVisuals: string[];
  confidence: number;
  confidenceReason: string;
  planningNotes: string;
  tokensUsed?: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

export interface RouterSection {
  allTools: ToolDecisionTrace[];
  selectedTools: string[];
  skippedTools: { tool: string; reason: string }[];
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

export interface SearchSection {
  tool: "SearchEngine" | "TrustedSourcesRetriever";
  used: boolean;
  reason: string;
  query: string;
  resultCount: number;
  sourcesSelected: { title: string; url: string }[];
  /** Neither search tool filters/rejects candidates internally today — always 0.
   *  Kept as a field (rather than removed) so it starts reporting real data the
   *  moment that filtering is added, with no inspector changes required. */
  sourcesRejected: number;
  durationMs: number;
}

export interface ScenePlanningSection {
  subjectStrategy: string;
  density: string;
  sceneCount: number;
  identifiedMisconceptions: string[];
  /** Structural issues from validateScenePlan.ts — "warning" issues don't
   *  block the pipeline, only EMPTY_PLAN (an "error") does. */
  validationIssues: { code: string; severity: "warning" | "error"; message: string; sceneId?: number }[];
  tokensUsed?: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

export interface GenerationSection {
  /** Which SceneAdapter produced this output, e.g. "WhiteboardSceneAdapter". */
  adapterName: string;
  sceneCount: number;
  sceneObjectTypeCounts: Record<string, number>;
  /** Scenes present in the ScenePlan but dropped during adaptation
   *  (e.g. the model returned malformed objects for that scene). */
  scenesDropped: number;
  narrationCharacterCount: number;
  animationCount: number;
  diagramCount: number;
  confidence: "High" | "Medium" | "Low";
  confidenceReason: string;
  tokensUsed?: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

export interface PerformanceMetrics {
  plannerMs: number;
  routerMs: number;
  searchMs: number;
  toolExecutionMs: number;
  scenePlanningMs: number;
  /** Time spent in the SceneAdapter (Stage 2) — what "lessonGenerationMs"
   *  used to mean back when a single Groq call did both planning and rendering. */
  lessonGenerationMs: number;
  renderPrepMs: number;
  totalMs: number;
  slowestStage: ExecutionStage["name"] | "none";
  plannerTokens?: number;
  generationTokens?: number;
  totalTokens?: number;
}

/** Mutable record being assembled while a request is in flight. */
export interface ExecutionTrace {
  id: string;
  question: string;
  startedAt: number;
  stages: ExecutionStage[];
  planner?: PlannerSection;
  router?: RouterSection;
  tools: ToolExecution[];
  search: SearchSection | null;
  scenePlanning?: ScenePlanningSection;
  generation?: GenerationSection;
  warnings: WarningEvent[];
}

/** Finalized, complete record — what's persisted and shown once a request
 *  finishes, whether it succeeded or failed partway through. */
export interface ExecutionReport {
  id: string;
  question: string;
  timestamp: string;
  totalDurationMs: number;
  stages: ExecutionStage[];
  planner: PlannerSection;
  router: RouterSection;
  tools: ToolExecution[];
  search: SearchSection | null;
  scenePlanning: ScenePlanningSection;
  generation: GenerationSection;
  performance: PerformanceMetrics;
  warnings: WarningEvent[];
}

/** Contract for the collector used while a lesson request is in flight.
 *  Callers record structured sections as the pipeline proceeds; finish()
 *  computes derived metrics (performance, auto-warnings) and freezes the
 *  result into an ExecutionReport. */
export interface ExecutionInspector {
  recordPlanner(section: PlannerSection): void;
  recordRouter(section: RouterSection): void;
  recordTool(execution: ToolExecution): void;
  recordSearch(section: SearchSection): void;
  recordScenePlanning(section: ScenePlanningSection): void;
  recordGeneration(section: GenerationSection): void;
  recordRenderPrep(durationMs: number, status?: ExecutionStatus): void;
  warn(event: WarningEvent): void;
  finish(): ExecutionReport;
}