export type SolutionStepRole =
  "understand" | "given" | "find" | "plan" | "calculation" | "reasoning" | "verify" | "answer";

export interface SolutionStep {
  id: string;
  questionPart: string;
  role: SolutionStepRole;
  reasoning: string;
  calculationRefs: string[];
}

export interface CalculationCheck {
  id: string;
  expression: string;
  result: string;
  units: string | null;
}

export interface LessonVariable {
  symbol: string;
  definition: string;
  units: string | null;
}

export interface LessonSolution {
  question: string;
  given: string[];
  find: string;
  method: string;
  variables: LessonVariable[];
  answer: string;
  exactValue: string | null;
  approximateValue: string | null;
  units: string | null;
  steps: SolutionStep[];
  calculations: CalculationCheck[];
  finalCalculationId: string | null;
  verification: string;
}

export function getLessonStepContext(
  solution: Pick<LessonSolution, "steps" | "calculations">,
  stepId: string,
) {
  const stepIndex = solution.steps.findIndex((step) => step.id === stepId);
  if (stepIndex < 0) throw new Error("The requested lesson step does not exist.");

  const currentStep = solution.steps[stepIndex];
  const calculationIds = new Set(currentStep.calculationRefs);
  return {
    previousSteps: solution.steps.slice(0, stepIndex),
    currentStep,
    citedCalculations: solution.calculations.filter((calculation) =>
      calculationIds.has(calculation.id),
    ),
  };
}

export type LessonStepExplanationMode = "why" | "simpler";

export interface LessonStepExplanationState {
  loading: boolean;
  explanation?: string;
  error?: string;
}

export type LessonVisualType =
  "diagram" | "equation" | "table" | "timeline" | "animation" | "text" | "none";

export interface LessonPlanScene {
  id: string;
  title: string;
  purpose: string;
  stepRefs: string[];
  visualType: LessonVisualType;
  visualPurpose: string | null;
}

export interface LessonPlan {
  title: string;
  objective: string;
  scenes: LessonPlanScene[];
}

export interface LessonScene {
  id: number;
  planSceneId: string;
  stepRefs: string[];
  visualPurpose: string | null;
  caption: string;
  narration: string;
  section?: string;
  doing?: string;
  why?: string;
  changed?: string;
  remember?: string;
  duration: number;
  view: Record<string, unknown>;
  actions: unknown[];
  [key: string]: unknown;
}

export interface LessonScript {
  title: string;
  scenes: LessonScene[];
  solution: LessonSolution;
  takeaway: string;
  challenge: {
    question: string;
    hint: string;
    answer: string;
    explanation?: string;
    remediation?: {
      likelyMisconception: string;
      simplerQuestion: string;
      simplerHint: string;
      simplerAnswer: string;
      explanation: string;
      stepRef: string;
    };
  };
  [key: string]: unknown;
}

const STEP_ROLES: SolutionStepRole[] = [
  "understand",
  "given",
  "find",
  "plan",
  "calculation",
  "reasoning",
  "verify",
  "answer",
];

const VISUAL_TYPES: LessonVisualType[] = [
  "diagram",
  "equation",
  "table",
  "timeline",
  "animation",
  "text",
  "none",
];

export function parseLessonSolution(value: unknown, expectedQuestion: string): LessonSolution {
  if (!isRecord(value)) throw new Error("The lesson is missing its question analysis.");
  if (!isBoundedNonEmptyString(value.question)) {
    throw new Error("The solution is missing required question analysis or verification fields.");
  }
  if (
    !Array.isArray(value.given) ||
    value.given.length > 12 ||
    !value.given.every(isBoundedNonEmptyString)
  ) {
    throw new Error("The solution is missing required question analysis or verification fields.");
  }
  if (!isBoundedNonEmptyString(value.find) || !isBoundedNonEmptyString(value.method)) {
    throw new Error("The solution is missing required question analysis or verification fields.");
  }
  if (!Array.isArray(value.variables) || value.variables.length > 12) {
    throw new Error("The solution is missing required question analysis or verification fields.");
  }
  if (
    !isBoundedNonEmptyString(value.answer) ||
    !Array.isArray(value.steps) ||
    value.steps.length < 1 ||
    value.steps.length > 12
  ) {
    throw new Error("The solution is missing required question analysis or verification fields.");
  }
  if (!Array.isArray(value.calculations) || value.calculations.length > 20) {
    throw new Error("The solution is missing required question analysis or verification fields.");
  }
  if (
    !isNullableString(value.exactValue) ||
    !isNullableString(value.approximateValue) ||
    !isNullableString(value.units) ||
    !isNullableString(value.finalCalculationId) ||
    !isBoundedNonEmptyString(value.verification)
  ) {
    throw new Error("The solution is missing required question analysis or verification fields.");
  }

  if (normalizeQuestion(value.question) !== normalizeQuestion(expectedQuestion)) {
    throw new Error("The solution does not preserve the student's exact question.");
  }

  const variables: LessonVariable[] = value.variables.map((item, index) => {
    if (
      !isRecord(item) ||
      !isBoundedNonEmptyString(item.symbol) ||
      !isBoundedNonEmptyString(item.definition) ||
      !isNullableString(item.units)
    ) {
      throw new Error(`Variable definition ${index + 1} is invalid.`);
    }
    return { symbol: item.symbol, definition: item.definition, units: item.units };
  });
  assertUniqueIds(
    variables.map((variable) => variable.symbol),
    "variable",
  );

  const calculations: CalculationCheck[] = value.calculations.map((item, index) => {
    if (
      !isRecord(item) ||
      !isBoundedNonEmptyString(item.id) ||
      !isBoundedNonEmptyString(item.expression) ||
      !isBoundedNonEmptyString(item.result) ||
      !isNullableString(item.units)
    ) {
      throw new Error(`Calculation ${index + 1} is missing its expression or stated result.`);
    }
    return {
      id: item.id,
      expression: item.expression,
      result: item.result,
      units: item.units,
    };
  });

  assertUniqueIds(
    calculations.map((item) => item.id),
    "calculation",
  );
  for (const calculation of calculations) verifyArithmeticCalculation(calculation);

  const calculationIds = new Set(calculations.map((item) => item.id));
  const steps: SolutionStep[] = value.steps.map((item, index) => {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["id", "questionPart", "role", "reasoning", "calculationRefs"]) ||
      !isBoundedNonEmptyString(item.id) ||
      !isBoundedNonEmptyString(item.questionPart) ||
      typeof item.role !== "string" ||
      !STEP_ROLES.includes(item.role as SolutionStepRole) ||
      !isBoundedNonEmptyString(item.reasoning) ||
      !Array.isArray(item.calculationRefs) ||
      !item.calculationRefs.every((ref) => typeof ref === "string" && calculationIds.has(ref))
    ) {
      throw new Error(`Solution step ${index + 1} is invalid or not traceable to the question.`);
    }
    return {
      id: item.id,
      questionPart: item.questionPart,
      role: item.role as SolutionStepRole,
      reasoning: item.reasoning,
      calculationRefs: item.calculationRefs,
    };
  });
  assertUniqueIds(
    steps.map((item) => item.id),
    "solution step",
  );
  const referencedCalculations = new Set(steps.flatMap((step) => step.calculationRefs));
  const unreferencedCalculations = calculations.filter(
    (item) => !referencedCalculations.has(item.id),
  );
  if (unreferencedCalculations.length > 0) {
    throw new Error(
      `Solution reasoning omits calculations: ${unreferencedCalculations.map((item) => item.id).join(", ")}.`,
    );
  }

  if (value.finalCalculationId !== null && !calculationIds.has(value.finalCalculationId)) {
    throw new Error("The final answer refers to a calculation that does not exist.");
  }
  if (value.finalCalculationId !== null) {
    const finalCalculation = calculations.find((item) => item.id === value.finalCalculationId);
    if (
      !finalCalculation ||
      !steps.some((step) => step.calculationRefs.includes(finalCalculation.id))
    ) {
      throw new Error("The final calculation is not connected to the solution reasoning.");
    }
    if (value.exactValue !== null && isArithmeticExpression(value.exactValue)) {
      const exact = evaluateArithmetic(value.exactValue);
      const calculated = evaluateArithmetic(finalCalculation.result);
      if (!numericallyEqual(exact, calculated)) {
        throw new Error("The exact answer does not match the final verified calculation.");
      }
    }
    if (value.approximateValue !== null && isDisplayNumber(value.approximateValue)) {
      const approximate = evaluateDisplayNumber(value.approximateValue);
      const tolerance = displayRoundingTolerance(value.approximateValue);
      const calculated = evaluateArithmetic(finalCalculation.result);
      if (Math.abs(approximate - calculated) > tolerance) {
        throw new Error("The approximate answer does not match the final verified calculation.");
      }
    }
  }

  return {
    question: expectedQuestion,
    given: value.given,
    find: value.find,
    method: value.method,
    variables,
    answer: value.answer,
    exactValue: value.exactValue,
    approximateValue: value.approximateValue,
    units: value.units,
    steps,
    calculations,
    finalCalculationId: value.finalCalculationId,
    verification: value.verification,
  };
}

export function parseLessonPlan(value: unknown, solution: LessonSolution): LessonPlan {
  if (
    !isRecord(value) ||
    !isBoundedNonEmptyString(value.title) ||
    !isBoundedNonEmptyString(value.objective) ||
    !Array.isArray(value.scenes) ||
    value.scenes.length < 1 ||
    value.scenes.length > 10
  ) {
    throw new Error("The teaching plan must contain a title, objective, and 1 to 10 scenes.");
  }

  const stepIds = new Set(solution.steps.map((step) => step.id));
  const scenes: LessonPlanScene[] = value.scenes.map((item, index) => {
    if (
      !isRecord(item) ||
      !isBoundedNonEmptyString(item.id) ||
      !isBoundedNonEmptyString(item.title) ||
      !isBoundedNonEmptyString(item.purpose) ||
      !Array.isArray(item.stepRefs) ||
      item.stepRefs.length === 0 ||
      !item.stepRefs.every((ref) => typeof ref === "string" && stepIds.has(ref)) ||
      typeof item.visualType !== "string" ||
      !VISUAL_TYPES.includes(item.visualType as LessonVisualType) ||
      !isNullableString(item.visualPurpose)
    ) {
      throw new Error(
        `Teaching-plan scene ${index + 1} is invalid or not linked to solution steps.`,
      );
    }
    if ((item.visualType === "none") !== (item.visualPurpose === null)) {
      throw new Error(`Teaching-plan scene ${index + 1} has an inconsistent visual purpose.`);
    }
    return {
      id: item.id,
      title: item.title,
      purpose: item.purpose,
      stepRefs: item.stepRefs,
      visualType: item.visualType as LessonVisualType,
      visualPurpose: item.visualPurpose,
    };
  });
  assertUniqueIds(
    scenes.map((scene) => scene.id),
    "teaching-plan scene",
  );

  const coveredSteps = new Set(scenes.flatMap((scene) => scene.stepRefs));
  const missingSteps = solution.steps.filter((step) => !coveredSteps.has(step.id));
  if (missingSteps.length > 0) {
    throw new Error(
      `Teaching plan omits solution steps: ${missingSteps.map((step) => step.id).join(", ")}.`,
    );
  }

  return { title: value.title, objective: value.objective, scenes };
}

export function parseLesson(
  text: string,
  expectedQuestion: string,
  expectedSolution?: LessonSolution,
  plan?: LessonPlan,
): LessonScript {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error("The response did not contain a JSON object.");
  }

  let lesson: unknown;
  try {
    lesson = JSON.parse(text.slice(firstBrace, lastBrace + 1));
  } catch {
    throw new Error("The response contained invalid JSON.");
  }

  if (!isRecord(lesson) || !isBoundedNonEmptyString(lesson.title)) {
    throw new Error("The lesson is missing its title.");
  }
  const solution = expectedSolution ?? parseLessonSolution(lesson.solution, expectedQuestion);
  if (solution.question !== expectedQuestion) {
    throw new Error("The lesson solution does not preserve the student's exact question.");
  }
  if (!Array.isArray(lesson.scenes) || lesson.scenes.length < 1 || lesson.scenes.length > 10) {
    throw new Error("The lesson must contain 1 to 10 planned scenes.");
  }
  if (plan && lesson.scenes.length !== plan.scenes.length) {
    throw new Error("The lesson scene count does not match the teaching plan.");
  }
  const solutionStepIds = new Set(solution.steps.map((step) => step.id));

  const scenes = lesson.scenes.map((scene, index) => {
    const planned = plan?.scenes[index];
    if (
      !isRecord(scene) ||
      !isBoundedNonEmptyString(scene.planSceneId) ||
      !Array.isArray(scene.stepRefs) ||
      scene.stepRefs.length === 0 ||
      !scene.stepRefs.every((ref) => typeof ref === "string" && solutionStepIds.has(ref)) ||
      (planned !== undefined &&
        (scene.planSceneId !== planned.id ||
          !sameStringSet(scene.stepRefs, planned.stepRefs) ||
          scene.visualPurpose !== planned.visualPurpose)) ||
      !isNullableString(scene.visualPurpose) ||
      !isBoundedNonEmptyString(scene.caption) ||
      !isBoundedNonEmptyString(scene.narration) ||
      typeof scene.id !== "number" ||
      typeof scene.duration !== "number" ||
      scene.duration <= 0 ||
      !isRecord(scene.view) ||
      !Array.isArray(scene.actions)
    ) {
      throw new Error(`Lesson scene ${index + 1} does not follow its teaching plan.`);
    }
    for (const field of ["section", "doing", "why", "changed", "remember"] as const) {
      if (scene[field] !== undefined && typeof scene[field] !== "string") {
        throw new Error(`Lesson scene ${index + 1} has an invalid ${field} field.`);
      }
    }
    return {
      ...scene,
      planSceneId: planned?.id ?? scene.planSceneId,
      stepRefs: planned?.stepRefs ?? scene.stepRefs,
      visualPurpose: planned?.visualPurpose ?? scene.visualPurpose,
    } as LessonScene;
  });

  assertUniqueIds(
    scenes.map((scene) => String(scene.id)),
    "lesson scene",
  );
  if (!isBoundedNonEmptyString(lesson.takeaway)) {
    throw new Error("The lesson is missing a takeaway.");
  }
  if (
    !isRecord(lesson.challenge) ||
    !isBoundedNonEmptyString(lesson.challenge.question) ||
    !isBoundedNonEmptyString(lesson.challenge.hint) ||
    !isBoundedNonEmptyString(lesson.challenge.answer)
  ) {
    throw new Error("The lesson is missing a complete practice question.");
  }
  if (
    lesson.challenge.explanation !== undefined &&
    !isBoundedNonEmptyString(lesson.challenge.explanation)
  ) {
    throw new Error("The lesson understanding check has an invalid explanation.");
  }
  if (lesson.challenge.remediation !== undefined) {
    const remediation = lesson.challenge.remediation;
    if (
      !isRecord(remediation) ||
      !isBoundedNonEmptyString(remediation.likelyMisconception) ||
      !isBoundedNonEmptyString(remediation.simplerQuestion) ||
      !isBoundedNonEmptyString(remediation.simplerHint) ||
      !isBoundedNonEmptyString(remediation.simplerAnswer) ||
      !isBoundedNonEmptyString(remediation.explanation) ||
      !isBoundedNonEmptyString(remediation.stepRef) ||
      !solution.steps.some((step) => step.id === remediation.stepRef)
    ) {
      throw new Error("The lesson understanding-check remediation is invalid.");
    }
  }

  const coveredSteps = new Set(scenes.flatMap((scene) => scene.stepRefs));
  if (solution.steps.some((step) => !coveredSteps.has(step.id))) {
    throw new Error("The teaching scenes do not cover every solution step.");
  }

  return {
    ...lesson,
    title: plan?.title ?? lesson.title,
    scenes,
    solution,
  } as unknown as LessonScript;
}

export function evaluateArithmetic(expression: string): number {
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+\-*/^]/g);
  if (!tokens || tokens.join("") !== expression.replace(/\s+/g, "")) {
    throw new Error("Calculation is not a supported arithmetic expression.");
  }

  let index = 0;
  const peek = () => tokens[index];
  const consume = () => tokens[index++];

  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };

  const parseTerm = (): number => {
    let value = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const right = parseUnary();
      if (operator === "/" && right === 0) throw new Error("Calculation divides by zero.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };

  const parseUnary = (): number => {
    if (peek() === "+") {
      consume();
      return parseUnary();
    }
    if (peek() === "-") {
      consume();
      return -parseUnary();
    }
    return parsePower();
  };

  const parsePower = (): number => {
    const value = parsePrimary();
    if (peek() !== "^") return value;
    consume();
    return value ** parseUnary();
  };

  const parsePrimary = (): number => {
    if (peek() === "(") {
      consume();
      const value = parseExpression();
      if (consume() !== ")") throw new Error("Calculation has unmatched parentheses.");
      return value;
    }
    const token = consume();
    if (!token || !/^\d+(?:\.\d+)?$/.test(token)) {
      throw new Error("Calculation is not a supported arithmetic expression.");
    }
    return Number(token);
  };

  const result = parseExpression();
  if (index !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Calculation could not be evaluated.");
  }
  return result;
}

function isDisplayNumber(value: string): boolean {
  try {
    evaluateDisplayNumber(value);
    return true;
  } catch {
    return false;
  }
}

function evaluateDisplayNumber(value: string): number {
  const trimmed = value.trim();
  const isPercent = trimmed.endsWith("%");
  const numeric = evaluateArithmetic(isPercent ? trimmed.slice(0, -1) : trimmed);
  return isPercent ? numeric / 100 : numeric;
}

function displayRoundingTolerance(value: string): number {
  const trimmed = value.trim().replace(/%$/, "");
  const decimalPlaces = trimmed.includes(".") ? trimmed.length - trimmed.indexOf(".") - 1 : 0;
  const tolerance = 0.5 * 10 ** -decimalPlaces;
  return value.trim().endsWith("%") ? tolerance / 100 : tolerance;
}

function isArithmeticExpression(expression: string): boolean {
  try {
    evaluateArithmetic(expression);
    return true;
  } catch {
    return false;
  }
}

function numericallyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-10 * Math.max(1, Math.abs(left), Math.abs(right));
}

function verifyArithmeticCalculation(calculation: CalculationCheck): void {
  try {
    const calculated = evaluateArithmetic(calculation.expression);
    const expected = evaluateArithmetic(calculation.result);
    if (!numericallyEqual(calculated, expected)) {
      throw new Error(
        `Calculation ${calculation.id} does not match: ${calculation.expression} = ${calculation.result}.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Calculation ")) throw error;
    throw new Error(
      `Calculation ${calculation.id} cannot be deterministically verified: ${calculation.expression} = ${calculation.result}.`,
    );
  }
}

function sameStringSet(left: unknown, right: string[]): boolean {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((item) => typeof item === "string" && right.includes(item))
  );
}

function assertUniqueIds(ids: string[], label: string): void {
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} IDs are not allowed.`);
}

function isBoundedNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 1000;
}

function normalizeQuestion(question: string): string {
  return question.normalize("NFC").replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.length > 0);
}

export function isCorrectUnderstandingAnswer(submitted: string, expected: string): boolean {
  const normalizedSubmitted = normalizeAnswerText(submitted);
  const normalizedExpected = normalizeAnswerText(expected);
  if (!normalizedSubmitted) return false;
  if (normalizedSubmitted === normalizedExpected) return true;

  const submittedValue = finalArithmeticValue(submitted);
  const expectedValue = finalArithmeticValue(expected);
  return (
    submittedValue !== null &&
    expectedValue !== null &&
    Math.abs(submittedValue - expectedValue) <=
      1e-10 * Math.max(1, Math.abs(submittedValue), Math.abs(expectedValue))
  );
}

function finalArithmeticValue(answer: string): number | null {
  const segments = answer.split(/=|\b(?:is|equals?)\b/i);
  const candidate = segments
    .at(-1)
    ?.trim()
    .replace(/[.!?;]+$/, "")
    .trim();
  if (!candidate) return null;
  try {
    return evaluateArithmetic(candidate);
  } catch {
    return null;
  }
}

function normalizeAnswerText(answer: string): string {
  return answer
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "")
    .toLowerCase();
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}
