import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const allowedActions = new Set([
  "drawAxes",
  "plotFunction",
  "plotPoints",
  "movePoint",
  "showLabel",
  "drawLine",
  "drawVector",
  "drawSegment",
  "tangentLine",
  "shadeArea",
  "drawShape",
  "highlight",
  "fade",
  "equationStep",
  "numberLine",
  "hopArrow",
  "cycleWheel",
  "calendarGrid",
  "table",
  "stepCards",
  "counter",
  "brace",
  "textBlock",
  "flowNode",
  "flowArrow",
  "timeline",
]);

const parserSource = await readFile(new URL("../src/lib/parseLesson.ts", import.meta.url), "utf8");
const parserJavascript = ts.transpileModule(parserSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const {
  evaluateArithmetic,
  getLessonStepContext,
  isCorrectUnderstandingAnswer,
  parseLesson,
  parseLessonPlan,
  parseLessonSolution,
} = await import(`data:text/javascript;base64,${Buffer.from(parserJavascript).toString("base64")}`);

test("fixture lesson matches the required structure", async () => {
  const raw = await readFile(
    new URL("../src/fixtures/parabola-lesson.json", import.meta.url),
    "utf8",
  );
  const lesson = JSON.parse(raw);

  assert.equal(typeof lesson.title, "string");
  assert.ok(Array.isArray(lesson.scenes) && lesson.scenes.length >= 5);
  assert.equal(lesson.solution.question, "What shape does y = x^2 make when we plot points?");
  assert.ok(Array.isArray(lesson.solution.given));
  assert.equal(typeof lesson.solution.find, "string");
  assert.equal(typeof lesson.solution.method, "string");
  assert.ok(lesson.solution.answer.length > 0);
  assert.ok(lesson.solution.steps.length >= 1);
  assert.equal(typeof lesson.solution.verification, "string");
  assert.ok(!JSON.stringify(lesson.scenes).includes("tangentLine"));
  assert.equal(typeof lesson.takeaway, "string");
  assert.ok(lesson.challenge && typeof lesson.challenge.question === "string");

  for (const scene of lesson.scenes) {
    assert.equal(typeof scene.id, "number");
    assert.equal(typeof scene.planSceneId, "string");
    assert.ok(scene.stepRefs.length > 0);
    assert.ok(scene.stepRefs.every((id) => lesson.solution.steps.some((step) => step.id === id)));
    assert.ok(scene.visualPurpose === null || typeof scene.visualPurpose === "string");
    assert.equal(typeof scene.caption, "string");
    assert.equal(typeof scene.narration, "string");
    assert.equal(typeof scene.duration, "number");
    assert.ok(scene.view && Array.isArray(scene.view.xRange) && Array.isArray(scene.view.yRange));
    assert.ok(Array.isArray(scene.actions));
    for (const action of scene.actions) {
      assert.ok(action && typeof action.do === "string");
      assert.ok(allowedActions.has(action.do), `Unexpected action: ${action.do}`);
      assert.equal(typeof action.t, "number");
    }
  }

  assert.doesNotThrow(() => parseLesson(raw, lesson.solution.question));
  assert.throws(() => parseLesson(raw, "Explain a different parabola question"));
  assert.equal(
    parseLesson(raw, `  ${lesson.solution.question}  `).solution.question,
    `  ${lesson.solution.question}  `,
  );
  assert.ok(lesson.scenes.every((scene) => !("doing" in scene)));
});

test("parser rejects a lesson that only teaches a topic without an exact solution", async () => {
  const raw = await readFile(
    new URL("../src/fixtures/parabola-lesson.json", import.meta.url),
    "utf8",
  );
  const lesson = JSON.parse(raw);
  delete lesson.solution;
  assert.throws(
    () => parseLesson(JSON.stringify(lesson), "What shape does y = x^2 make when we plot points?"),
    /question analysis/,
  );
});

test("understanding check validates answers and bounds remediation to lesson steps", async () => {
  const raw = await readFile(
    new URL("../src/fixtures/parabola-lesson.json", import.meta.url),
    "utf8",
  );
  const lesson = JSON.parse(raw);
  lesson.challenge.explanation = "Substitute -2 into the rule and square it.";
  lesson.challenge.remediation = {
    likelyMisconception: "The exponent applies to the input value.",
    simplerQuestion: "What is 1 squared?",
    simplerHint: "Multiply 1 by itself.",
    simplerAnswer: "1",
    explanation: "1 times 1 equals 1.",
    stepRef: lesson.solution.steps[0].id,
  };

  assert.doesNotThrow(() => parseLesson(JSON.stringify(lesson), lesson.solution.question));
  lesson.challenge.remediation.stepRef = "missing-step";
  assert.throws(
    () => parseLesson(JSON.stringify(lesson), lesson.solution.question),
    /understanding-check remediation is invalid/,
  );

  assert.equal(isCorrectUnderstandingAnswer("4", "y = (-2)^2 = 4."), true);
  assert.equal(isCorrectUnderstandingAnswer("0.5", "1/2"), true);
  assert.equal(isCorrectUnderstandingAnswer("3", "y = (-2)^2 = 4."), false);
  assert.equal(isCorrectUnderstandingAnswer("", "4"), false);
});

test("question analysis requires every grounding field and preserves the exact user question", async () => {
  const raw = await readFile(
    new URL("../src/fixtures/parabola-lesson.json", import.meta.url),
    "utf8",
  );
  const solution = JSON.parse(raw).solution;
  const exactQuestion = `  ${solution.question}  `;
  const parsed = parseLessonSolution(solution, exactQuestion);

  assert.equal(parsed.question, exactQuestion);
  assert.deepEqual(parsed.given, solution.given);
  assert.equal(parsed.find, solution.find);
  assert.equal(parsed.method, solution.method);
  assert.equal(parsed.verification, solution.verification);
  assert.throws(() => parseLessonSolution({ ...solution, find: "" }, exactQuestion));
});

test("question steps allow equivalent question references but enforce the step schema", async () => {
  const raw = await readFile(
    new URL("../src/fixtures/parabola-lesson.json", import.meta.url),
    "utf8",
  );
  const solution = structuredClone(JSON.parse(raw).solution);
  const question = solution.question;
  solution.steps[0].questionPart = "the specified function and requested graph shape";

  assert.doesNotThrow(() => parseLessonSolution(solution, question));
  assert.throws(
    () =>
      parseLessonSolution(
        {
          ...solution,
          steps: [
            { ...solution.steps[0], extraField: "not in the schema" },
            ...solution.steps.slice(1),
          ],
        },
        question,
      ),
    /Solution step 1 is invalid/,
  );
});

test("question analysis supports conceptual questions without invented numeric givens", () => {
  const question = "Why does a refrigerator keep food cold?";
  const solution = parseLessonSolution(
    {
      question,
      given: [],
      find: "Explain how heat is removed from the refrigerator's interior.",
      method: "Trace the heat-transfer cycle through the refrigerant.",
      variables: [],
      answer: "A refrigerator moves heat from inside the cabinet to the surrounding room.",
      exactValue: null,
      approximateValue: null,
      units: null,
      steps: [
        {
          id: "step-1",
          questionPart: "whole question",
          role: "reasoning",
          reasoning: "The refrigerant absorbs heat as it evaporates inside the cabinet.",
          calculationRefs: [],
        },
        {
          id: "step-2",
          questionPart: "whole question",
          role: "answer",
          reasoning: "The compressor and condenser release that heat into the room.",
          calculationRefs: [],
        },
      ],
      calculations: [],
      finalCalculationId: null,
      verification: "The described cycle transfers heat outward rather than creating cold.",
    },
    question,
  );

  assert.deepEqual(solution.given, []);
  assert.equal(solution.exactValue, null);
  assert.equal(solution.approximateValue, null);
  assert.equal(solution.units, null);
});

test("deterministically verifies arithmetic and exact probability results", () => {
  const question =
    "A bag contains 5 red balls and 4 blue balls. What is the probability of drawing 2 red balls without replacement?";
  const solution = parseLessonSolution(
    {
      question,
      given: ["5 red balls", "4 blue balls", "Two draws without replacement"],
      find: "The probability both draws are red.",
      method: "Multiply the conditional probabilities of red on each draw.",
      variables: [],
      answer: "The probability is 5/18, about 27.78%.",
      exactValue: "5/18",
      approximateValue: "27.78%",
      units: "%",
      steps: [
        {
          id: "step-1",
          questionPart: "5 red balls and 4 blue balls",
          role: "given",
          reasoning: "There are 9 balls total, so the first red probability is 5/9.",
          calculationRefs: ["calc-1"],
        },
        {
          id: "step-2",
          questionPart: "without replacement",
          role: "calculation",
          reasoning: "After a red draw, 4 red balls remain among 8 balls.",
          calculationRefs: ["calc-2"],
        },
        {
          id: "step-3",
          questionPart: "drawing 2 red balls",
          role: "calculation",
          reasoning: "Both draws must be red, so multiply 5/9 by 4/8.",
          calculationRefs: ["calc-3"],
        },
        {
          id: "step-4",
          questionPart: "What is the probability",
          role: "answer",
          reasoning: "Reduce 20/72 to 5/18 and convert it to about 27.78%.",
          calculationRefs: ["calc-4"],
        },
      ],
      calculations: [
        { id: "calc-1", expression: "5/(5+4)", result: "5/9", units: null },
        { id: "calc-2", expression: "(5-1)/(9-1)", result: "4/8", units: null },
        { id: "calc-3", expression: "5/9 * 4/8", result: "20/72", units: null },
        { id: "calc-4", expression: "20/72", result: "5/18", units: null },
      ],
      finalCalculationId: "calc-4",
      verification: "The product 20/72 reduces to 5/18, approximately 27.78%.",
    },
    question,
  );

  assert.equal(evaluateArithmetic("5/9 * 4/8"), 20 / 72);
  assert.equal(evaluateArithmetic("(5-1)/(9-1)"), 0.5);
  assert.equal(evaluateArithmetic("-2^2"), -4);
  assert.equal(evaluateArithmetic("(-2)^2"), 4);
  assert.equal(evaluateArithmetic("2^3^2"), 512);
  assert.equal(evaluateArithmetic("2^-2"), 0.25);
  assert.equal(solution.finalCalculationId, "calc-4");

  const stepContext = getLessonStepContext(solution, "step-3");
  assert.deepEqual(
    stepContext.previousSteps.map((step) => step.id),
    ["step-1", "step-2"],
  );
  assert.equal(stepContext.currentStep.id, "step-3");
  assert.deepEqual(
    stepContext.citedCalculations.map((calculation) => calculation.id),
    ["calc-3"],
  );
  assert.throws(() => getLessonStepContext(solution, "missing-step"), /does not exist/);
});

test("rejects incorrect arithmetic even when the final answer claims verification", () => {
  const question = "What is 5/9 times 4/8?";
  const solution = {
    question,
    given: ["5/9", "4/8"],
    find: "The product.",
    method: "Multiply the fractions.",
    variables: [],
    answer: "The product is 5/18.",
    exactValue: "5/18",
    approximateValue: null,
    units: null,
    steps: [
      {
        id: "step-1",
        questionPart: "5/9 times 4/8",
        role: "calculation",
        reasoning: "Multiply numerators and denominators.",
        calculationRefs: ["calc-1"],
      },
    ],
    calculations: [{ id: "calc-1", expression: "5/9*4/8", result: "5/8", units: null }],
    finalCalculationId: "calc-1",
    verification: "Claimed verified.",
  };

  assert.throws(() => parseLessonSolution(solution, question), /does not match/);
});

test("parser accepts guided fields when present on scenes", async () => {
  const raw = await readFile(
    new URL("../src/fixtures/parabola-lesson.json", import.meta.url),
    "utf8",
  );
  const lesson = JSON.parse(raw);
  for (const scene of lesson.scenes) {
    Object.assign(scene, {
      section: "Understanding the pattern",
      doing: "We compare several points on the curve.",
      why: "The repeated shape reveals the rule.",
      changed: "More of the curve appears.",
      remember: "A square rule creates a parabola.",
    });
  }

  const parsed = parseLesson(JSON.stringify(lesson), lesson.solution.question);
  assert.equal(parsed.scenes[0].section, "Understanding the pattern");
  assert.equal(parsed.scenes[0].doing, "We compare several points on the curve.");
});

test("teaching plan must cover every question-grounded reasoning step", async () => {
  const raw = await readFile(
    new URL("../src/fixtures/parabola-lesson.json", import.meta.url),
    "utf8",
  );
  const lesson = JSON.parse(raw);
  const plan = {
    title: lesson.title,
    objective: lesson.solution.find,
    scenes: lesson.scenes.map((scene) => ({
      id: scene.planSceneId,
      title: scene.caption,
      purpose: scene.caption,
      stepRefs: scene.stepRefs,
      visualType: "diagram",
      visualPurpose: scene.visualPurpose,
    })),
  };

  assert.equal(parseLessonPlan(plan, lesson.solution).scenes.length, lesson.scenes.length);
  const solution = parseLessonSolution(lesson.solution, lesson.solution.question);
  assert.throws(
    () => parseLessonPlan({ ...plan, scenes: plan.scenes.slice(0, 1) }, lesson.solution),
    /omits solution steps/,
  );
  const conflictingLesson = structuredClone(lesson);
  conflictingLesson.scenes[0].visualPurpose = "Show an unrelated visual.";
  assert.throws(
    () =>
      parseLesson(
        JSON.stringify(conflictingLesson),
        lesson.solution.question,
        solution,
        parseLessonPlan(plan, solution),
      ),
    /teaching plan/,
  );
});
