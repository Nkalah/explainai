import type { Tool, ToolResult } from "../types";

export const confidenceEvaluator: Tool = {
  metadata: {
    name: "ConfidenceEvaluator",
    description:
      "Determines the final confidence rating for a lesson based on whether grounding tools succeeded and found relevant material.",
    whenToUse: "Always — every lesson gets a confidence rating.",
    whenNeverToUse: "Never skipped.",
    subjects: ["general"],
    priority: 1, // runs last, sequentially, after other tools' results are known
    canRunInParallel: false,
    optionalOnFailure: false,
    implemented: true,
  },
  async run(): Promise<ToolResult> {
    // Actual confidence logic runs in the Lesson Generator once it has all
    // ToolResults available (it needs to see whether grounding tools
    // succeeded/found data) — this entry exists so the router's execution
    // order and tool list stay complete and self-documenting.
    return {
      tool: "ConfidenceEvaluator",
      success: true,
      summary: "Evaluated downstream by the Lesson Generator using other tools' results.",
    };
  },
};
