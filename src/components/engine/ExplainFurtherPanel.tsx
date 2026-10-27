import { useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import type { EngineLesson } from "@/lib/engineTypes";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_FOLLOW_UPS = [
  "Explain like I'm 10",
  "Show another example",
  "Quiz me",
  "Explain visually",
  "Real world application",
  "Common mistakes",
  "Practice questions",
  "Harder version",
];

/**
 * `onSendMessage` is the integration point into your actual AI call.
 * It receives the full lesson (for context) and prior chat history, and
 * must resolve to the assistant's reply. This is intentionally left as a
 * prop rather than an inline fetch — wire it to whatever already makes
 * your Groq calls elsewhere in the pipeline, passing the lesson through as
 * grounding context so the model continues the existing lesson rather than
 * starting fresh. A mock fallback is used if none is provided, so this
 * panel is demoable standalone.
 */
export function ExplainFurtherPanel({
  lesson,
  question,
  onSendMessage,
}: {
  lesson: EngineLesson;
  question: string;
  onSendMessage?: (message: string, history: ChatMessage[], lesson: EngineLesson) => Promise<string>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!text.trim() || isThinking) return;
    const userMessage: ChatMessage = { role: "user", content: text.trim() };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");
    setIsThinking(true);

    try {
      const reply = onSendMessage
        ? await onSendMessage(text.trim(), nextHistory, lesson)
        : await mockReply(text.trim(), lesson);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong answering that — try asking again." },
      ]);
    } finally {
      setIsThinking(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" }));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles size={15} className="text-brand" />
              Explain Further
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ask anything about this lesson — I already know what we just covered.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed " +
              (m.role === "user"
                ? "ml-auto bg-foreground text-background"
                : "bg-secondary text-foreground")
            }
          >
            {m.content}
          </div>
        ))}

        {isThinking && (
          <div className="w-fit rounded-2xl bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
            Thinking…
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 border-t px-3 py-2.5">
        {SUGGESTED_FOLLOW_UPS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={isThinking}
            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this lesson…"
          className="flex-1 rounded-full border bg-background/60 px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-brand/50"
        />
        <button
          type="submit"
          disabled={isThinking || !input.trim()}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 disabled:opacity-30"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

async function mockReply(message: string, lesson: EngineLesson): Promise<string> {
  await new Promise((r) => setTimeout(r, 500));
  return `(Placeholder reply — wire "onSendMessage" to your real AI call.) You asked: "${message}" about "${lesson.title}". Once connected, this will answer using the full lesson as context.`;
}