import { generateAnswer, type AnswerResult } from "@/lib/generateAnswer";
import { useState } from "react";
import { Whiteboard } from "./Whiteboard";
import { LessonEngine } from "@/components/engine/LessonEngine";
import { generateLesson, type LessonResult } from "@/lib/generateLesson";
import { AttachMenu, AttachmentChips, type Attachment } from "@/components/site/AttachMenu";

/* ---------- Hero ---------- */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, oklch(0.93 0.05 268 / 0.6), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
            Now generating lessons for early access users
          </div>
          <h1 className="font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95] tracking-tight text-foreground">
            Every question deserves
            <br />
            <span className="italic text-foreground/80">its own teacher.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Ask anything. ExplainAI writes it out on a whiteboard, narrates the reasoning, and
            hands you back a lesson video made only for you.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            
           <a   href="#try"
              className="inline-flex h-11 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-transform hover:scale-[1.02]"
            >
              Try free →
            </a>

            
           <a   href="#how"
              className="inline-flex h-11 items-center rounded-full border bg-background/60 px-6 text-sm font-medium backdrop-blur transition-colors hover:bg-background"
            >
              Watch demo
            </a>
          </div>
          <div className="mt-6 font-mono text-xs text-muted-foreground">
            No credit card · 3 free lessons · Cancel anytime
          </div>
        </div>

        {/* Hero artifact */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-8 -z-10 rounded-[32px]"
            style={{
              background:
                "linear-gradient(180deg, transparent, oklch(0.54 0.19 268 / 0.12) 60%, transparent)",
              filter: "blur(40px)",
            }}
          />
          <Whiteboard />
        </div>
      </div>
    </section>
  );
}

/* ---------- Ask input (Try) ---------- */
const suggestions = [
  "Solve x² + 5x + 6 = 0",
  "Explain derivatives",
  "Why does gravity exist?",
  "How does recursion work?",
];

export function TryInput() {
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [lesson, setLesson] = useState<LessonResult | null>(null);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  function addAttachments(next: Attachment[]) {
    setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }

  async function handleAsk(q: string) {
    if (!q.trim() && attachments.length === 0) return;
    setLoadingAnswer(true);
    setError(null);
    setAnswer(null);
    setLesson(null);
    try {
      // NOTE: generateAnswer currently only accepts { question: string }.
      // Attachments are captured and shown in the UI, but the backend
      // doesn't read file contents yet — that needs a multimodal-capable
      // model call (e.g. sending base64 images to a vision model) before
      // uploaded photos/audio/files can actually influence the answer.
      const result = await generateAnswer({ data: { question: q } });
      setAskedQuestion(q);
      setAnswer(result);
    } catch (err) {
      console.error(err);
      setError("Something went wrong answering that. Try again.");
    } finally {
      setLoadingAnswer(false);
    }
  }

  async function handleExplainVisually() {
    setLoadingLesson(true);
    setError(null);
    try {
      const result = await generateLesson({ data: { question: askedQuestion } });
      setLesson(result);
    } catch (err) {
      console.error(err);
      setError("Something went wrong building that lesson. Try again.");
    } finally {
      setLoadingLesson(false);
    }
  }

  return (
    <section id="try" className="border-y bg-secondary/40">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Ask anything</div>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">What would you like to learn today?</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(question);
          }}
          className="mx-auto mt-8 max-w-xl"
        >
          <AttachmentChips attachments={attachments} onRemove={removeAttachment} />
          <div className="flex items-center gap-2 rounded-full border bg-background p-2 shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_50px_-30px_rgba(15,15,30,0.2)]">
            <AttachMenu onAdd={addAttachments} />
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted-foreground"
              placeholder="e.g. Explain photosynthesis to a 10-year-old"
            />
            <button
              type="submit"
              disabled={loadingAnswer}
              className="inline-flex h-10 flex-shrink-0 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {loadingAnswer ? "Thinking…" : "Ask"}
            </button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQuestion(s);
                handleAsk(s);
              }}
              className="rounded-full border bg-background px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>

        {error && <p className="mt-6 text-sm text-red-500">{error}</p>}

        {answer && !lesson && (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border bg-background p-6 text-left">
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{answer.answer}</p>

            {answer.sources.length > 0 && (
              <div className="mt-4 border-t pt-4 text-xs">
                <div className="mb-2 font-medium text-foreground">Sources</div>
                <ul className="space-y-1">
                  {answer.sources.map((s) => (
                    <li key={s.url}>
                      
                      <a  href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:underline"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleExplainVisually}
              disabled={loadingLesson}
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-full border bg-secondary px-4 text-sm font-medium transition-colors hover:bg-secondary/70 disabled:opacity-50"
            >
              {loadingLesson ? "Building your lesson…" : "🎓 Show me a full visual lesson"}
            </button>
          </div>
        )}

        {lesson && (
          <div className="mx-auto mt-8 max-w-xl">
            <LessonEngine lesson={lesson} question={askedQuestion} />
            <div className="mt-4 flex items-center justify-between rounded-xl border bg-background px-4 py-3 text-left text-xs">
              <div>
                <span className="font-medium text-foreground">Confidence: {lesson.confidence}</span>
                {lesson.confidenceReason && (
                  <span className="text-muted-foreground"> — {lesson.confidenceReason}</span>
                )}
              </div>
            </div>

            {lesson.sources.length > 0 && (
              <div className="mt-3 rounded-xl border bg-background px-4 py-3 text-left text-xs">
                <div className="mb-2 font-medium text-foreground">Sources used</div>
                <ul className="space-y-1">
                  {lesson.sources.map((s) => (
                    <li key={s.url}>
                      
                      <a  href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:underline"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Features ---------- */
const features = [
  {
    kicker: "Realtime video",
    title: "A brand-new lesson for every question.",
    body: "No prerecorded content, no YouTube links. Each video is generated the moment you ask — narrated, animated, and tailored to your level.",
  },
  {
    kicker: "Whiteboard engine",
    title: "Teaches the way a great tutor would.",
    body: "Equations are written stroke by stroke. Important terms get circled. Answers are boxed. Diagrams draw themselves.",
  },
  {
    kicker: "Natural narration",
    title: "A voice that actually explains things.",
    body: "Multiple voices, adjustable pacing, and perfect sync with the whiteboard. It pauses where it matters and emphasizes what counts.",
  },
  {
    kicker: "Ask follow-ups",
    title: "Your tutor remembers the lesson.",
    body: "Confused about step 3? Ask again a different way. Request another example. Switch modes — from Explain Like I'm 10 to Deep Dive — in one tap.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-28">
      <div className="mx-auto max-w-2xl text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Features</div>
        <h2 className="mt-3 font-display text-4xl md:text-5xl leading-[1.05]">
          Built to teach, not to answer.
        </h2>
      </div>
      <div className="mt-16 grid gap-4 md:grid-cols-2">
        {features.map((f) => (
          <article
            key={f.kicker}
            className="group relative flex flex-col rounded-2xl border bg-card p-8 transition-shadow hover:shadow-[0_1px_0_rgba(0,0,0,0.02),0_30px_60px_-40px_rgba(15,15,30,0.25)]"
          >
            <div className="font-mono text-[11px] uppercase tracking-widest text-brand">
              {f.kicker}
            </div>
            <h3 className="mt-3 font-display text-2xl leading-snug">{f.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */
const steps = [
  {
    n: "01",
    title: "Ask.",
    body: "Type or paste a question — from a homework problem to a curious rabbit hole.",
  },
  {
    n: "02",
    title: "AI teaches on a whiteboard.",
    body: "ExplainAI reasons through the problem, plans a lesson, and animates it live.",
  },
  {
    n: "03",
    title: "Watch, follow up, remember.",
    body: "Rewatch at your pace. Ask why. Get flashcards, notes, and quizzes — automatically.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t bg-secondary/40">
      <div className="mx-auto max-w-6xl px-6 py-28">
        <div className="grid gap-16 md:grid-cols-[1fr_1.4fr] md:gap-24">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">How it works</div>
            <h2 className="mt-3 font-display text-4xl md:text-5xl leading-[1.05]">
              From question to lesson in seconds.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              ExplainAI orchestrates reasoning, scriptwriting, animation and narration into one
              continuous stream — so learning feels like watching someone think out loud.
            </p>
          </div>
          <ol className="relative border-l">
            {steps.map((s) => (
              <li key={s.n} className="relative pl-8 pb-12 last:pb-0">
                <span className="absolute -left-[7px] top-1.5 block h-3.5 w-3.5 rounded-full border-2 border-background bg-foreground" />
                <div className="font-mono text-xs text-brand">{s.n}</div>
                <h3 className="mt-1 font-display text-2xl">{s.title}</h3>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------- Testimonials ---------- */
const quotes = [
  {
    q: "This is the first time a computer has actually taught me something. I watched a 40-second video and finally got integration by parts.",
    a: "Priya S.",
    r: "MSc student, Imperial College",
  },
  {
    q: "My daughter asked why the sky is blue. ExplainAI drew Rayleigh scattering on a whiteboard while narrating. She rewatched it four times.",
    a: "Marcus D.",
    r: "Parent",
  },
  {
    q: "It replaced two of my tutoring subscriptions. Every lesson is exactly the length I need and never off-topic.",
    a: "Adaeze O.",
    r: "High school senior",
  },
];

export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      <div className="mx-auto max-w-2xl text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Loved by learners</div>
        <h2 className="mt-3 font-display text-4xl md:text-5xl leading-[1.05]">
          "Finally, teaching that feels made for me."
        </h2>
      </div>
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {quotes.map((t) => (
          <figure key={t.a} className="flex h-full flex-col rounded-2xl border bg-card p-7">
            <blockquote className="font-display text-xl leading-snug">"{t.q}"</blockquote>
            <figcaption className="mt-6 flex items-center gap-3 border-t pt-4">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-medium">
                {t.a.charAt(0)}
              </div>
              <div className="text-sm">
                <div className="font-medium">{t.a}</div>
                <div className="text-muted-foreground">{t.r}</div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ---------- Pricing ---------- */
const tiers = [
  {
    name: "Free",
    price: "$0",
    tag: "For the curious",
    features: ["3 lessons / month", "Standard voice", "Basic subjects", "Save & rewatch"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$18",
    tag: "For serious learners",
    features: [
      "Unlimited lessons",
      "Premium voices & accents",
      "All subjects & levels",
      "Notes, flashcards, quizzes",
      "Follow-up chat",
      "Download MP4 & PDF",
    ],
    cta: "Go Pro",
    highlight: true,
  },
  {
    name: "Team",
    price: "$48",
    tag: "For classrooms & tutors",
    features: [
      "Everything in Pro",
      "5 seats included",
      "Shared collections",
      "Progress dashboards",
      "Priority rendering",
    ],
    cta: "Start team trial",
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-y bg-secondary/40">
      <div className="mx-auto max-w-6xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Pricing</div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl leading-[1.05]">
            One tutor. Three ways to learn.
          </h2>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={
                "relative flex flex-col rounded-2xl border p-8 " +
                (t.highlight
                  ? "border-foreground bg-card shadow-[0_20px_60px_-30px_rgba(15,15,30,0.35)]"
                  : "bg-card/60")
              }
            >
              {t.highlight && (
                <span className="absolute -top-3 left-8 rounded-full bg-foreground px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-background">
                  Most popular
                </span>
              )}
              <div className="font-display text-2xl">{t.name}</div>
              <div className="text-sm text-muted-foreground">{t.tag}</div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-5xl">{t.price}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <svg viewBox="0 0 16 16" className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                className={
                  "mt-8 inline-flex h-11 items-center justify-center rounded-full text-sm font-medium transition-transform hover:scale-[1.02] " +
                  (t.highlight
                    ? "bg-foreground text-background"
                    : "border bg-background")
                }
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
const faqs = [
  {
    q: "Is every video really generated in real time?",
    a: "Yes. When you ask a question, ExplainAI writes a teaching script, plans the whiteboard animation, generates the narration, and renders the video — no prerecorded content or YouTube links involved.",
  },
  {
    q: "What subjects does it cover?",
    a: "Mathematics (from arithmetic to differential equations), physics, chemistry, biology, programming (Python, JS, C++, and more), computer science, economics, history and languages.",
  },
  {
    q: "How is this different from ChatGPT?",
    a: "ChatGPT gives you text. ExplainAI gives you a lesson — a narrated whiteboard video built specifically for your question and your level. You watch a teacher think, not read an answer.",
  },
  {
    q: "Can I download the videos?",
    a: "Pro and Team users can download lessons as MP4, export the transcript, and generate PDF notes, flashcards and quizzes for every lesson.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Your questions and lessons are yours. We never train models on your content and you can delete your history at any time.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-28">
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">FAQ</div>
        <h2 className="mt-3 font-display text-4xl md:text-5xl leading-[1.05]">Good questions.</h2>
      </div>
      <dl className="mt-12 divide-y border-y">
        {faqs.map((f) => (
          <details key={f.q} className="group py-6">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
              <dt className="font-display text-xl leading-snug">{f.q}</dt>
              <span className="mt-1.5 inline-block h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                </svg>
              </span>
            </summary>
            <dd className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{f.a}</dd>
          </details>
        ))}
      </dl>
    </section>
  );
}

/* ---------- Final CTA ---------- */
export function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 100%, oklch(0.54 0.19 268 / 0.18), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-3xl px-6 py-32 text-center">
        <h2 className="font-display text-5xl md:text-6xl leading-[1]">
          Learn anything.
          <br />
          <span className="italic text-foreground/70">Beautifully.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-md text-muted-foreground">
          Your personal teacher is one question away.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          
            <a href="#try"
            className="inline-flex h-12 items-center rounded-full bg-foreground px-7 text-sm font-medium text-background transition-transform hover:scale-[1.02]"
          >
            Try ExplainAI free →
          </a>
        </div>
      </div>
    </section>
  );
}