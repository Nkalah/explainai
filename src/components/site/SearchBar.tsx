import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

const suggestions = [
  "Solve x² + 5x + 6 = 0",
  "Explain derivatives",
  "Why does gravity exist?",
  "How does recursion work?",
];

/**
 * Lives only on the landing page. Its one job is to capture the first
 * question and hand off to /chat — it never shows an answer itself.
 */
export function SearchBar() {
  const [question, setQuestion] = useState("");
  const navigate = useNavigate();

  function goAsk(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate({ to: "/chat", search: { q: trimmed } });
  }

  return (
    <section id="try" className="border-y bg-secondary/40">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Ask anything
        </div>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">
          What would you like to learn today?
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            goAsk(question);
          }}
          className="mx-auto mt-8 max-w-xl"
        >
          <div className="flex items-center gap-2 rounded-full border bg-background p-2 shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_50px_-30px_rgba(15,15,30,0.2)]">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              aria-label="Your question"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground"
              placeholder="e.g. Explain photosynthesis to a 10-year-old"
            />
            <button
              type="submit"
              className="inline-flex h-11 flex-shrink-0 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-transform hover:scale-[1.02]"
            >
              Ask
            </button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => goAsk(s)}
              className="min-h-11 rounded-full border bg-background px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
