import type { ToolRouter, ToolRegistry, ToolResult, RoutingDecision, ToolRequest } from "./types";
import type { LessonPlan } from "../lessonPlan";
import { toolRegistry } from "./registry";

/** Maps a lesson plan's declared needs to candidate tools. This is the ONLY
 *  place that has subject-specific routing logic — every tool itself stays
 *  generic and unaware of the others. Adding a new tool means adding one line
 *  here that says when it's relevant; the execution machinery below never
 *  needs to change. */
function candidateToolsForPlan(plan: LessonPlan, question: string): RoutingDecision[] {
  const decisions: RoutingDecision[] = [];
  const q = question.toLowerCase();
  const visuals = new Set(plan.recommendedVisuals);
  const subjectLower = plan.subject.toLowerCase();

  const push = (
    tool: RoutingDecision["tool"],
    shouldRun: boolean,
    confidence: number,
    reason: string,
  ) => {
    decisions.push({ tool, shouldRun, confidence, reason });
  };

  // --- Grounding / factual tools ---
  const needsFacts = !["math", "programming"].some((s) => subjectLower.includes(s));
  push(
    "TrustedSourcesRetriever",
    needsFacts && plan.difficulty !== "Elementary",
    needsFacts ? 0.7 : 0.2,
    needsFacts
      ? "Non-math/programming subject likely benefits from grounded sources."
      : "Subject is stable/computational.",
  );
  push(
    "SearchEngine",
    /current|latest|recent|today|yesterday|this year|news/.test(q),
    /current|latest|recent|today|yesterday|this year|news/.test(q) ? 0.85 : 0.1,
    "Question phrasing suggests time-sensitive/current information is needed.",
  );
  push(
    "Wikipedia",
    false,
    0.1,
    "Not implemented yet; TrustedSourcesRetriever covers this need for now.",
  );
  push("ImageSearch", false, 0.05, "Not implemented yet.");

  // --- Math tools ---
  const isMath =
    subjectLower.includes("math") ||
    subjectLower.includes("algebra") ||
    subjectLower.includes("calculus") ||
    subjectLower.includes("geometry");
  push(
    "Calculator",
    isMath && /[\d]+\s*[\+\-\*\/]\s*[\d]/.test(q),
    isMath ? 0.6 : 0.1,
    "Arithmetic expression detected in a math question.",
  );
  push(
    "EquationSolver",
    isMath && /solve|equation|=/.test(q),
    isMath ? 0.6 : 0.1,
    "Question asks to solve an equation.",
  );
  push(
    "GeometryVisualizer",
    isMath && visuals.has("Shape"),
    0.5,
    "Plan recommends shape visuals for a math topic.",
  );
  push(
    "GraphGenerator",
    visuals.has("Graph"),
    visuals.has("Graph") ? 0.7 : 0.1,
    "Plan recommends a graph visual.",
  );

  // --- Programming tools ---
  const isProgramming =
    subjectLower.includes("programming") ||
    subjectLower.includes("code") ||
    subjectLower.includes("computer science");
  push(
    "PythonCodeExecutor",
    false,
    isProgramming ? 0.3 : 0.05,
    "No sandboxed execution environment implemented yet.",
  );
  push(
    "ProgrammingVisualizer",
    isProgramming && visuals.has("CodeAnimation"),
    isProgramming ? 0.6 : 0.1,
    "Plan recommends code animation for a programming topic.",
  );

  // --- Everyday utility tools ---
  push(
    "DateCalculator",
    /\bdate|day of the week|years? (from|ago)|days? (from|ago)\b/.test(q),
    /\bdate|day of the week/.test(q) ? 0.8 : 0.2,
    "Question involves date arithmetic.",
  );
  push(
    "UnitConverter",
    /convert|how many (km|miles|kg|lbs|celsius|fahrenheit)/.test(q),
    /convert/.test(q) ? 0.7 : 0.1,
    "Question asks for a unit conversion.",
  );

  // --- Structural / diagram tools ---
  push(
    "TimelineGenerator",
    visuals.has("Timeline"),
    visuals.has("Timeline") ? 0.6 : 0.1,
    "Plan recommends a timeline visual.",
  );
  push(
    "FlowchartGenerator",
    visuals.has("Flowchart"),
    visuals.has("Flowchart") ? 0.6 : 0.1,
    "Plan recommends a flowchart visual.",
  );
  push(
    "MermaidDiagramGenerator",
    false,
    0.05,
    "Not implemented; FlowchartGenerator/SVGWhiteboardGenerator cover current diagram needs.",
  );
  push(
    "SVGWhiteboardGenerator",
    false,
    0.1,
    "Scene rendering is already handled directly by the Lesson Generator + Engine; not a separate tool call yet.",
  );

  // --- Engagement tools ---
  push(
    "QuizGenerator",
    plan.includeQuiz,
    plan.includeQuiz ? 0.9 : 0.05,
    "Plan explicitly requested a quiz.",
  );
  push(
    "PracticeQuestionGenerator",
    plan.includePractice,
    plan.includePractice ? 0.9 : 0.05,
    "Plan explicitly requested practice questions.",
  );
  push("FlashcardGenerator", false, 0.05, "Not implemented yet.");
  push(
    "SummaryGenerator",
    false,
    0.05,
    "Lesson Generator already produces objective/summary inline; not a separate tool call yet.",
  );

  // --- Meta tool, always runs ---
  push(
    "ConfidenceEvaluator",
    true,
    1,
    "Always run to attach a final confidence rating to the lesson.",
  );

  return decisions;
}

class DefaultToolRouter implements ToolRouter {
  constructor(private registry: ToolRegistry) {}

  async decide(question: string, plan: LessonPlan): Promise<RoutingDecision[]> {
    return candidateToolsForPlan(plan, question);
  }

  async route(question: string, plan: LessonPlan): Promise<ToolResult[]> {
    const decisions = await this.decide(question, plan);
    const toRun = decisions.filter((d) => d.shouldRun);

    const registered = toRun
      .map((d) => ({ decision: d, tool: this.registry.get(d.tool) }))
      .filter(
        (
          x,
        ): x is { decision: RoutingDecision; tool: NonNullable<ReturnType<ToolRegistry["get"]>> } =>
          x.tool != null,
      );

    // Split into parallel-safe vs sequential groups, sequential ones ordered by priority (desc).
    const parallelGroup = registered.filter((x) => x.tool.metadata.canRunInParallel);
    const sequentialGroup = registered
      .filter((x) => !x.tool.metadata.canRunInParallel)
      .sort((a, b) => b.tool.metadata.priority - a.tool.metadata.priority);

    const request: ToolRequest = { question, plan };

    const runOne = async (entry: {
      tool: NonNullable<ReturnType<ToolRegistry["get"]>>;
      decision: RoutingDecision;
    }): Promise<ToolResult> => {
      const start = Date.now();
      try {
        const result = await entry.tool.run(request);
        return { ...result, durationMs: Date.now() - start };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Tool "${entry.tool.metadata.name}" failed:`, message);
        return {
          tool: entry.tool.metadata.name,
          success: false,
          error: message,
          durationMs: Date.now() - start,
        };
      }
    };

    const parallelResults = await Promise.all(parallelGroup.map(runOne));

    const sequentialResults: ToolResult[] = [];
    for (const entry of sequentialGroup) {
      sequentialResults.push(await runOne(entry));
    }

    const allResults = [...parallelResults, ...sequentialResults];

    // Fallback behavior: a failed tool marked optionalOnFailure is simply
    // dropped from what gets passed downstream (its ToolResult still exists,
    // with success: false, for logging — the Lesson Generator filters these out).
    return allResults;
  }
}

export const toolRouter: ToolRouter = new DefaultToolRouter(toolRegistry);
