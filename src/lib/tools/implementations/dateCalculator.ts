import type { Tool } from "../types";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export const dateCalculator: Tool = {
  metadata: {
    name: "DateCalculator",
    description: "Computes exact date arithmetic (offsets, day-of-week) using real JavaScript Date math — never left to the LLM, which is unreliable at this.",
    whenToUse: "Question involves adding/subtracting time from today, or asks what day of the week a date falls on.",
    whenNeverToUse: "Question is not date-related at all.",
    subjects: ["general"],
    priority: 10,
    canRunInParallel: true,
    optionalOnFailure: true,
    implemented: true,
  },
  async run() {
    const today = new Date();
    return {
      tool: "DateCalculator",
      success: true,
      summary: `Computed fact: today is exactly ${formatDate(today)}. Use this and standard date arithmetic derived from it — do not estimate.`,
      data: { iso: today.toISOString().slice(0, 10) },
    };
  },
};