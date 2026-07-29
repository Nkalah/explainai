// src/lib/tools/types.ts
//
// Central contract for the tool system (Tool/ToolRegistry/ToolRouter) AND
// the Development Execution Inspector's telemetry types (ExecutionReport,
// WarningEvent, etc). Kept in one file since both are consumed together
// across router.ts, registry.ts, Inspector.ts, Store.ts, and Serverfns.ts.

import type { LessonPlan } from "../lessonPlan";

/* ============================================================
   TOOL SYSTEM
   ============================================================ */

export type ToolName =
  | "TrustedSourcesRetriever"
  | "SearchEngine"
  | "Wikipedia"
  | "ImageSearch"
  | "Calculator"
  | "EquationSolver"
  | "GeometryVisualizer"
  | "GraphGenerator"
  | "PythonCodeExecutor"
  | "ProgrammingVisualizer"
  | "DateCalculator"
  | "UnitConverter"
  | "TimelineGenerator"
  | "FlowchartGenerator"
  | "MermaidDiagramGenerator"
  | "SVGWhiteboardGenerator"
  | "QuizGenerator"
  | "PracticeQuestionGenerator"
  | "FlashcardGenerator"
  | "SummaryGenerator"
  | "ConfidenceEvaluator";

export interface ToolRequest {
  question: string;
  plan: LessonPlan;
}

export interface ToolResult {
  tool: ToolName | string;
  success: boolean;
  summary?: string;
  error?: string;
  data?: unknown;
  durationMs?: number;
}

export interface ToolMetadata {
  name: ToolName;
  description: string;
  whenToUse: string;
  whenNeverToUse: string;
  subjects: string[];
  priority: number;
  canRunInParallel: boolean;
  optionalOnFailure: boolean;
  implemented: boolean;
}

export interface Tool {
  metadata: ToolMetadata;
  run(request: ToolRequest): Promise<ToolResult>;
}

export interface ToolRegistry {
  register(tool: Tool): void;
  get(name: ToolName): Tool | undefined;
  all(): Tool[];
}

export interface RoutingDecision {
  tool: ToolName;
  shouldRun: boolean;
  confidence: number;
  reason: string;
}

export interface ToolRouter {
  decide(question: string, plan: LessonPlan): Promise<RoutingDecision[]>;
  route(question: string, plan: LessonPlan): Promise<ToolResult[]>;
}

/* ============================================================
   DEVELOPMENT EXECUTION INSPECTOR (telemetry)
   ============================================================ */

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
  | "REQUEST_FAILED";

export interface WarningEvent {
  code: WarningCode;
  message: string;
  severity: "warning" | "error";
  stage: "planner" | "router" | "tool" | "search" | "generation" | "performance";
  detail?: Record<string, string | number | boolean | null>;
}

export interface ExecutionStage {
  name: "planner" | "router" | "tools" | "search" | "generation" | "renderPrep";
  status: ExecutionStatus;
  durationMs: number;
}

export interface ToolDecisionTrace {
  tool: string;
  shouldRun: boolean;
  routingConfidence: number;
  reason: string;
  priority: number;
  canRunInParallel: boolean;
  implemented: boolean;
}

export interface ToolExecution {
  tool: string;
  success: boolean;
  routingConfidence?: number;
  warnings: string[];
  error?: string;
  retryAttempts: number;
  fallbackUsed: boolean;
  executionMode: "parallel" | "sequential";
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
  sourcesRejected: number;
  durationMs: number;
}

export interface GenerationSection {
  sceneCount: number;
  sceneObjectTypeCounts: Record<string, number>;
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
  lessonGenerationMs: number;
  renderPrepMs: number;
  totalMs: number;
  slowestStage: ExecutionStage["name"] | "none";
  plannerTokens?: number;
  generationTokens?: number;
  totalTokens?: number;
}

export interface ExecutionTrace {
  id: string;
  question: string;
  startedAt: number;
  stages: ExecutionStage[];
  planner?: PlannerSection;
  router?: RouterSection;
  tools: ToolExecution[];
  search: SearchSection | null;
  generation?: GenerationSection;
  warnings: WarningEvent[];
}

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
  generation: GenerationSection;
  performance: PerformanceMetrics;
  warnings: WarningEvent[];
}

export interface ExecutionInspector {
  recordPlanner(section: PlannerSection): void;
  recordRouter(section: RouterSection): void;
  recordTool(execution: ToolExecution): void;
  recordSearch(section: SearchSection): void;
  recordGeneration(section: GenerationSection): void;
  recordRenderPrep(durationMs: number, status?: ExecutionStatus): void;
  warn(event: WarningEvent): void;
  finish(): ExecutionReport;
}