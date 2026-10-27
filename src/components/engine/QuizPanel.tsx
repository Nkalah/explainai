import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import type { EngineLesson } from "@/lib/engineTypes";

export interface QuizQuestion {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

/**
 * `onGenerateQuiz` is the integration point into your real quiz-generation
 * call (should be grounded ONLY in the lesson's content, per spec — pass
 * the lesson through, not the original open-ended question). A mock
 * fallback derived from scene objectives is used if none is provided.
 */
export function QuizPanel({
  lesson,
  onGenerateQuiz,
}: {
  lesson: EngineLesson;
  onGenerateQuiz?: (lesson: EngineLesson) => Promise<QuizQuestion[]>;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    setChecked(false);
    setAnswers({});
    try {
      const q = onGenerateQuiz ? await onGenerateQuiz(lesson) : await mockQuiz(lesson);
      setQuestions(q);
    } finally {
      setLoading(false);
    }
  }

  if (!questions) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">Test what you just learned with a short quiz.</p>
        <button
          onClick={start}
          disabled={loading}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-transform hover:scale-105 disabled:opacity-50"
        >
          {loading ? "Building your quiz…" : "Quiz Me"}
        </button>
      </div>
    );
  }

  const score = questions.reduce((s, q) => (answers[q.id] === q.correctIndex ? s + 1 : s), 0);
  const allAnswered = questions.every((q) => answers[q.id] != null);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <div className="space-y-4">
        {questions.map((q, qi) => {
          const selected = answers[q.id];
          return (
            <div key={q.id} className="rounded-xl border p-3">
              <p className="mb-2 text-sm font-medium text-foreground">
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-1.5">
                {q.choices.map((choice, ci) => {
                  const isSelected = selected === ci;
                  const isCorrect = checked && ci === q.correctIndex;
                  const isWrongSelected = checked && isSelected && ci !== q.correctIndex;
                  return (
                    <button
                      key={ci}
                      disabled={checked}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: ci }))}
                      className={
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors " +
                        (isCorrect
                          ? "border-green-500/40 bg-green-500/10 text-foreground"
                          : isWrongSelected
                          ? "border-red-500/40 bg-red-500/10 text-foreground"
                          : isSelected
                          ? "border-brand/50 bg-brand/10"
                          : "hover:bg-secondary")
                      }
                    >
                      {choice}
                      {isCorrect && <Check size={14} className="text-green-600" />}
                      {isWrongSelected && <X size={14} className="text-red-500" />}
                    </button>
                  );
                })}
              </div>
              {checked && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{q.explanation}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 mt-3 flex items-center justify-between border-t bg-card/95 pt-3">
        {checked ? (
          <>
            <span className="text-sm font-medium text-foreground">
              Score: {score} / {questions.length}
            </span>
            <button
              onClick={start}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <RotateCcw size={13} /> Retake
            </button>
          </>
        ) : (
          <button
            onClick={() => setChecked(true)}
            disabled={!allAnswered}
            className="w-full rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            Check answers
          </button>
        )}
      </div>
    </div>
  );
}

async function mockQuiz(lesson: EngineLesson): Promise<QuizQuestion[]> {
  await new Promise((r) => setTimeout(r, 500));
  return lesson.scenes.slice(0, 5).map((scene, i) => ({
    id: `q${i}`,
    question: `Placeholder question about: ${scene.title}`,
    choices: ["Option A", "Option B", "Option C", "Option D"],
    correctIndex: 0,
    explanation: "Wire \"onGenerateQuiz\" to your real quiz-generation call to replace this placeholder.",
  }));
}