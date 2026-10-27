import { readFile } from "node:fs/promises";

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error("FAIL: GROQ_API_KEY is not set.");
  process.exitCode = 1;
} else {
  try {
    const solverPrompt = await readFile(
      new URL("../prompts/question_solver_prompt.txt", import.meta.url),
      "utf8",
    );
    const systemPrompt = await readFile(
      new URL("../prompts/lesson_system_prompt.txt", import.meta.url),
      "utf8",
    );
    const question = "Explain why y = x^2 makes a parabola";
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: solverPrompt },
          { role: "user", content: JSON.stringify({ question, referenceAnswer: null }) },
        ],
      }),
    });
    if (!response.ok)
      throw new Error(`Groq API returned ${response.status}: ${await response.text()}`);

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content;
    const firstBrace = raw?.indexOf("{") ?? -1;
    const lastBrace = raw?.lastIndexOf("}") ?? -1;
    if (firstBrace < 0 || lastBrace < firstBrace) throw new Error("Response did not contain JSON.");
    const analysis = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    if (
      analysis.question !== question ||
      !Array.isArray(analysis.given) ||
      typeof analysis.find !== "string" ||
      typeof analysis.method !== "string" ||
      typeof analysis.answer !== "string" ||
      !Array.isArray(analysis.steps) ||
      typeof analysis.verification !== "string"
    ) {
      throw new Error("Question analysis did not match the required structure.");
    }

    const lessonResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              question,
              verifiedQuestionAnalysis: analysis,
              instruction:
                "Create the lesson scenes from this question analysis. It is authoritative: do not change the question, givens, requested result, method, answer, or reasoning.",
            }),
          },
        ],
      }),
    });
    if (!lessonResponse.ok) {
      throw new Error(`Groq API returned ${lessonResponse.status}: ${await lessonResponse.text()}`);
    }

    const lessonResult = await lessonResponse.json();
    const lessonContent = lessonResult.choices?.[0]?.message?.content;
    const lessonStart = lessonContent?.indexOf("{") ?? -1;
    const lessonEnd = lessonContent?.lastIndexOf("}") ?? -1;
    if (lessonStart < 0 || lessonEnd < lessonStart) {
      throw new Error("Lesson response did not contain JSON.");
    }
    const lesson = {
      ...JSON.parse(lessonContent.slice(lessonStart, lessonEnd + 1)),
      solution: analysis,
    };
    if (
      typeof lesson.title !== "string" ||
      !Array.isArray(lesson.scenes) ||
      lesson.scenes.length < 5 ||
      lesson.scenes.length > 8 ||
      typeof lesson.takeaway !== "string" ||
      typeof lesson.challenge !== "object" ||
      lesson.challenge === null ||
      !lesson.scenes.every(
        (scene) =>
          typeof scene.id === "number" &&
          typeof scene.caption === "string" &&
          typeof scene.narration === "string" &&
          typeof scene.duration === "number" &&
          typeof scene.view === "object" &&
          scene.view !== null &&
          Array.isArray(scene.actions),
      )
    ) {
      throw new Error("Parsed JSON did not match the required lesson shape.");
    }

    console.log(JSON.stringify(lesson, null, 2));
    console.log("PASS");
  } catch (error) {
    console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
