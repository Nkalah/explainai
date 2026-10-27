import { createServerFn } from "@tanstack/react-start";
import systemPrompt from "../../prompts/lesson_system_prompt.txt?raw";
import solverPrompt from "../../prompts/question_solver_prompt.txt?raw";
import verifierPrompt from "../../prompts/solution_verifier_prompt.txt?raw";
import lessonPlanPrompt from "../../prompts/lesson_plan_prompt.txt?raw";
import lessonVerifierPrompt from "../../prompts/lesson_verifier_prompt.txt?raw";
import { callGroqJson, callGroqText } from "./groqClient";
import { GroqRateLimitError } from "./groqRateLimitError";
import {
  parseLesson,
  parseLessonPlan,
  parseLessonSolution,
  type LessonPlan,
  type LessonSolution,
} from "./parseLesson";
import { z } from "zod";

export type AnswerResult = {
  answer: string;
  sources: { title: string; url: string }[];
  error?: string;
};

const AnswerInputSchema = z.object({
  question: z.string().min(1, "Question is required").max(2000, "Question is too long"),
  referenceAnswer: z.string().max(8000).optional(),
  conversationContext: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(12)
    .optional(),
});

const VERIFICATION_CHECKS = [
  "arithmetic",
  "algebra",
  "units",
  "formulaSelection",
  "variableDefinitions",
  "intermediateValues",
  "finalAnswer",
  "logicalConsistency",
  "answersQuestion",
] as const;

const isDev = process.env.NODE_ENV !== "production";

type VerificationCheck = (typeof VERIFICATION_CHECKS)[number];
type SolutionVerification = {
  passed: boolean;
  checks: Record<VerificationCheck, boolean>;
  issues: string[];
};

const LESSON_VERIFICATION_CHECKS = [
  "questionGrounding",
  "answerCompleteness",
  "solutionFidelity",
  "stepTraceability",
  "visualFidelity",
  "practiceConsistency",
] as const;

type LessonVerificationCheck = (typeof LESSON_VERIFICATION_CHECKS)[number];

type LessonVerification = {
  passed: boolean;
  issues: string[];
};

function buildSolverPrompt(
  question: string,
  referenceAnswer?: string,
  conversationContext?: Array<{ role: "user" | "assistant"; content: string }>,
  correction?: string[],
): string {
  return JSON.stringify({
    question,
    referenceAnswer: referenceAnswer?.trim().slice(0, 8000) || null,
    conversationContext: conversationContext ?? [],
    correction: correction?.length ? correction : null,
    correctionInstruction: correction?.length
      ? "The previous response was rejected by validation. Correct every listed issue while preserving the exact question and return only the required JSON object."
      : null,
  });
}

class SolutionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SolutionValidationError";
  }
}

async function solveQuestion(
  question: string,
  referenceAnswer?: string,
  conversationContext?: Array<{ role: "user" | "assistant"; content: string }>,
  correction?: string[],
): Promise<LessonSolution> {
  const response = await callGroqJson([
    { role: "system", content: solverPrompt },
    {
      role: "user",
      content: buildSolverPrompt(question, referenceAnswer, conversationContext, correction),
    },
  ]);
  if (isDev) {
    console.info("[lesson-generation] solution response before validation", {
      question,
      rawModelResponse: response.raw ?? null,
    });
  }
  if (!response.data) {
    throw new SolutionValidationError("The model returned no structured question analysis.");
  }
  try {
    return parseLessonSolution(response.data, question);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The model returned an invalid question analysis.";
    throw new SolutionValidationError(message);
  }
}

function parseSolutionVerification(value: unknown): SolutionVerification {
  if (
    !isRecord(value) ||
    typeof value.passed !== "boolean" ||
    !isRecord(value.checks) ||
    !Array.isArray(value.issues) ||
    !value.issues.every((issue) => typeof issue === "string" && issue.trim())
  ) {
    throw new Error("The verifier returned an invalid validation report.");
  }

  const checks = {} as Record<VerificationCheck, boolean>;
  for (const check of VERIFICATION_CHECKS) {
    if (typeof value.checks[check] !== "boolean") {
      throw new Error(`The verifier omitted the ${check} check.`);
    }
    checks[check] = value.checks[check];
  }

  const passed = Object.values(checks).every(Boolean) && value.issues.length === 0;
  if (value.passed !== passed) {
    throw new Error("The verifier's pass status conflicts with its checks or issues.");
  }
  return { passed, checks, issues: value.issues };
}

async function verifySolution(
  question: string,
  solution: LessonSolution,
  conversationContext?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<SolutionVerification> {
  const { data } = await callGroqJson([
    { role: "system", content: verifierPrompt },
    {
      role: "user",
      content: JSON.stringify({
        question,
        conversationContext: conversationContext ?? [],
        candidateSolution: solution,
      }),
    },
  ]);
  if (!data) throw new Error("The verifier returned no solution validation report.");
  return parseSolutionVerification(data);
}

async function planLesson(question: string, solution: LessonSolution): Promise<LessonPlan> {
  const { data } = await callGroqJson([
    { role: "system", content: lessonPlanPrompt },
    { role: "user", content: JSON.stringify({ question, verifiedSolution: solution }) },
  ]);
  if (!data) throw new Error("The lesson planner returned no teaching plan.");
  return parseLessonPlan(data, solution);
}

function buildLessonPrompt(
  question: string,
  solution: LessonSolution,
  plan: LessonPlan,
  renderingFeedback: string[],
  conversationContext?: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  return JSON.stringify({
    question,
    conversationContext: conversationContext ?? [],
    verifiedQuestionAnalysis: solution,
    lessonPlan: plan,
    instruction:
      "Render exactly one lesson scene for each lessonPlan scene in order. Preserve each plan scene id, stepRefs, and visualPurpose exactly.",
    renderingFeedback,
  });
}

function parseLessonVerification(value: unknown): LessonVerification {
  if (
    !isRecord(value) ||
    typeof value.passed !== "boolean" ||
    !isRecord(value.checks) ||
    !Array.isArray(value.issues) ||
    !value.issues.every((issue) => typeof issue === "string" && issue.trim())
  ) {
    throw new Error("The lesson verifier returned an invalid validation report.");
  }

  const failedChecks: LessonVerificationCheck[] = [];
  for (const check of LESSON_VERIFICATION_CHECKS) {
    if (typeof value.checks[check] !== "boolean") {
      throw new Error(`The lesson verifier omitted the ${check} check.`);
    }
    if (!value.checks[check]) failedChecks.push(check);
  }

  const passed = failedChecks.length === 0 && value.issues.length === 0;
  if (value.passed !== passed) {
    throw new Error("The lesson verifier's pass status conflicts with its checks or issues.");
  }
  return {
    passed,
    issues: value.issues.length
      ? value.issues
      : failedChecks.map((check) => `Failed ${check} lesson validation.`),
  };
}

async function verifyRenderedLesson(
  question: string,
  solution: LessonSolution,
  plan: LessonPlan,
  lesson: unknown,
  conversationContext?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<LessonVerification> {
  const { data } = await callGroqJson([
    {
      role: "system",
      content: `${lessonVerifierPrompt}\n\nFor practiceConsistency, independently verify both the understanding-check answer and the simpler remediation answer and explanation against their questions and the verified solution. Confirm the remediation stepRef identifies a relevant solution step.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        question,
        conversationContext: conversationContext ?? [],
        verifiedSolution: solution,
        plan,
        lesson,
      }),
    },
  ]);
  if (!data) throw new Error("The lesson verifier returned no validation report.");
  return parseLessonVerification(data);
}

async function generateLessonJson(
  question: string,
  referenceAnswer?: string,
  conversationContext?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  let solution: LessonSolution | undefined;
  let validationIssues: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      solution = await solveQuestion(
        question,
        referenceAnswer,
        conversationContext,
        validationIssues,
      );
    } catch (error) {
      if (!(error instanceof SolutionValidationError)) throw error;
      validationIssues = [`The question analysis was rejected: ${error.message}`];
      continue;
    }
    const verification = await verifySolution(question, solution, conversationContext);
    if (verification.passed) break;
    validationIssues = verification.issues.length
      ? verification.issues
      : VERIFICATION_CHECKS.filter((check) => !verification.checks[check]).map(
          (check) => `Failed independent ${check} check.`,
        );
    solution = undefined;
  }

  if (!solution) {
    throw new Error(
      `The proposed solution did not pass independent verification: ${validationIssues.join("; ")}`,
    );
  }

  const plan = await planLesson(question, solution);
  try {
    let renderingIssues: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await callGroqText([
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: buildLessonPrompt(
            question,
            solution,
            plan,
            renderingIssues,
            conversationContext,
          ),
        },
      ]);
      if (isDev) {
        console.info("[lesson-generation] renderer response before validation", {
          question,
          rawModelResponse: response.text,
        });
      }
      let lesson;
      try {
        lesson = parseLesson(response.text, question, solution, plan);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The lesson response was invalid.";
        renderingIssues = [
          `The previous renderer response was rejected: ${message}. Return a single valid JSON object. Escape backslashes in strings, omit trailing commas, and preserve the required lesson schema and plan references.`,
        ];
        if (attempt === 1) throw error;
        continue;
      }
      const verification = await verifyRenderedLesson(
        question,
        solution,
        plan,
        lesson,
        conversationContext,
      );
      if (verification.passed) return JSON.stringify(lesson);
      renderingIssues = verification.issues;
    }
    throw new Error(
      `The generated lesson did not pass independent validation: ${renderingIssues.join("; ")}`,
    );
  } catch (error) {
    if (error instanceof GroqRateLimitError) throw error;
    const message = error instanceof Error ? error.message : "Unknown lesson rendering error.";
    throw new Error(`Unable to render the verified teaching plan: ${message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const generateAnswerServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => AnswerInputSchema.parse(data))
  .handler(async ({ data }): Promise<AnswerResult> => {
    try {
      return {
        answer: await generateLessonJson(
          data.question,
          data.referenceAnswer,
          data.conversationContext,
        ),
        sources: [],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unexpected lesson generation error occurred.";
      return { answer: JSON.stringify({ error: message }), sources: [], error: message };
    }
  });

export async function generateAnswer(
  question: string,
  referenceAnswer?: string,
  conversationContext?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<AnswerResult> {
  return generateAnswerServerFn({ data: { question, referenceAnswer, conversationContext } });
}
