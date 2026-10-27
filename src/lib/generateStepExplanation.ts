import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import stepExplanationPrompt from "../../prompts/step_explanation_prompt.txt?raw";
import { callGroqText } from "./groqClient";
import { getLessonStepContext, type LessonSolution } from "./parseLesson";

const StepExplanationInputSchema = z.object({
  question: z.string().min(1).max(2000),
  given: z.array(z.string().min(1).max(1000)).max(12),
  find: z.string().min(1).max(1000),
  method: z.string().min(1).max(1000),
  answer: z.string().min(1).max(2000),
  steps: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        questionPart: z.string().min(1).max(1000),
        role: z.enum([
          "understand",
          "given",
          "find",
          "plan",
          "calculation",
          "reasoning",
          "verify",
          "answer",
        ]),
        reasoning: z.string().min(1).max(2000),
        calculationRefs: z.array(z.string().max(80)).max(20),
      }),
    )
    .min(1)
    .max(12),
  calculations: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        expression: z.string().min(1).max(500),
        result: z.string().min(1).max(500),
        units: z.string().max(100).nullable(),
      }),
    )
    .max(20),
  stepId: z.string().min(1).max(80),
  mode: z.enum(["why", "simpler"]),
});

const GenerateStepExplanationInputSchema = StepExplanationInputSchema.omit({
  stepId: true,
  mode: true,
});

type StepExplanationInput = z.infer<typeof StepExplanationInputSchema>;

function lessonSolutionInput(solution: LessonSolution) {
  return {
    question: solution.question,
    given: solution.given,
    find: solution.find,
    method: solution.method,
    answer: solution.answer,
    steps: solution.steps,
    calculations: solution.calculations,
  };
}

const generateStepExplanationServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => StepExplanationInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ explanation: string }> => {
    const stepContext = getLessonStepContext(data, data.stepId);
    const context = {
      originalQuestion: data.question,
      given: data.given,
      requestedResult: data.find,
      verifiedMethod: data.method,
      verifiedAnswer: data.answer,
      ...stepContext,
      request: data.mode,
    };
    const { text } = await callGroqText([
      { role: "system", content: stepExplanationPrompt },
      { role: "user", content: JSON.stringify(context) },
    ]);
    const explanation = text.trim();
    if (!explanation || explanation.length > 5000 || explanation.startsWith("{")) {
      throw new Error("The tutor returned an unusable step explanation.");
    }
    return { explanation };
  });

export async function generateStepExplanation(
  solution: LessonSolution,
  stepId: string,
  mode: StepExplanationInput["mode"],
): Promise<string> {
  const input = {
    ...lessonSolutionInput(solution),
    stepId,
    mode,
  };
  const validated = GenerateStepExplanationInputSchema.parse(input);
  const result = await generateStepExplanationServerFn({
    data: { ...validated, stepId, mode },
  });
  return result.explanation;
}
