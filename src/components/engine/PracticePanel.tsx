import { useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import type { EngineLesson } from "@/lib/engineTypes";

export type PracticeDifficulty = "Easy" | "Medium" | "Hard";

export interface PracticeProblem {
  id: string;
  prompt: string;
  hint: string;
  answer: string;
}

/**
 * `onGeneratePractice` is the integration point into your real
 * practice-question generation call, using the lesson's concept as the
 * basis for new (not repeated) problems at the requested difficulty.
 * A mock fallback is used if none is provided.
 */
export function PracticePanel({
  lesson,
  onGeneratePractice,
}: {
  lesson: EngineLesson;
  onGeneratePractice?: (lesson: EngineLesson, difficulty: PracticeDifficulty) => Promise<PracticeProblem[]>;
}) {
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>("Easy");
  const [problems, setProblems] = useState<PracticeProblem[] | null>(null);
  const [revealed, setRevealed] = useState<Record<string, "hint" | "answer" | undefined>>({});
  const [loading, setLoading] = useState(false);

  async function generate(diff: PracticeDifficulty) {
    setDifficulty(diff);
    setLoading(true);
    setRevealed({});
    try {
      const p = onGeneratePractice ? await onGeneratePractice(lesson, diff) : await mockPractice(lesson, diff);
      setProblems(p);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <div className="mb-3 flex gap-1.5">
        {(["Easy", "Medium", "Hard"] as PracticeDifficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => generate(d)}
            className={
              "flex-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
              (difficulty === d && problems ? "border-brand/50 bg-brand/10 text-foreground" : "hover:bg-secondary")
            }
          >
            {d}
          </button>
        ))}
      </div>

      {!problems && !loading && (
        <button
          onClick={() => generate("Easy")}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Generate practice problems
        </button>
      )}

      {loading && <p className="text-sm text-muted-foreground">Building problems…</p>}

      <div className="space-y-3">
        {problems?.map((p, i) => (
          <div key={p.id} className="rounded-xl border p-3">
            <p className="mb-2 text-sm font-medium text-foreground">
              {i + 1}. {p.prompt}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setRevealed((r) => ({ ...r, [p.id]: "hint" }))}
                className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary"
              >
                <Eye size={11} /> Hint
              </button>
              <button
                onClick={() => setRevealed((r) => ({ ...r, [p.id]: "answer" }))}
                className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary"
              >
                Show answer
              </button>
            </div>
            {revealed[p.id] === "hint" && (
              <p className="mt-2 text-xs italic text-muted-foreground">{p.hint}</p>
            )}
            {revealed[p.id] === "answer" && (
              <p className="mt-2 text-xs font-medium text-brand">{p.answer}</p>
            )}
          </div>
        ))}
      </div>

      {problems && (
        <button
          onClick={() => generate(difficulty)}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          <RefreshCw size={12} /> New set
        </button>
      )}
    </div>
  );
}

async function mockPractice(lesson: EngineLesson, difficulty: PracticeDifficulty): Promise<PracticeProblem[]> {
  await new Promise((r) => setTimeout(r, 500));
  return Array.from({ length: 3 }).map((_, i) => ({
    id: `p${i}`,
    prompt: `${difficulty} placeholder problem #${i + 1} based on "${lesson.title}".`,
    hint: "Wire \"onGeneratePractice\" to your real generation call to replace this placeholder hint.",
    answer: "Placeholder answer.",
  }));
}