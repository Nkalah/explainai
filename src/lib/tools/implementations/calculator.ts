import type { Tool } from "../types";

/** Extremely restricted arithmetic evaluator: digits, + - * / ( ) . and
 *  whitespace only. Deliberately does NOT use eval()/Function() on arbitrary
 *  input — this is a real, if minimal, safety boundary. */
function safeEvaluate(expr: string): number | null {
  const cleaned = expr.replace(/\s+/g, "");
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${cleaned});`)();
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

export const calculator: Tool = {
  metadata: {
    name: "Calculator",
    description: "Evaluates a plain arithmetic expression exactly, using real computation instead of LLM estimation.",
    whenToUse: "The question or lesson plan contains a concrete arithmetic expression to evaluate.",
    whenNeverToUse: "Symbolic algebra (use EquationSolver instead, when implemented), or when no explicit numeric expression is present.",
    subjects: ["math"],
    priority: 9,
    canRunInParallel: true,
    optionalOnFailure: true,
    implemented: true,
  },
  async run(request) {
    const match = request.question.match(/[\d.\s+\-*/()]{3,}/);
    if (!match) {
      return { tool: "Calculator", success: false, error: "No arithmetic expression found in question." };
    }
    const value = safeEvaluate(match[0]);
    if (value === null) {
      return { tool: "Calculator", success: false, error: "Expression could not be safely evaluated." };
    }
    return {
      tool: "Calculator",
      success: true,
      summary: `Computed fact: ${match[0].trim()} = ${value}. State this exact value — do not recompute or second-guess it.`,
      data: { expression: match[0].trim(), value },
    };
  },
};