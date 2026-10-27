import { useCallback, useEffect, useRef, useState } from "react";
import { generateAnswer, type AnswerResult } from "@/lib/generateAnswer";
import { generateLesson, type LessonResult } from "@/lib/generateLesson";
import type { Attachment } from "@/components/site/AttachMenu";

export type ChatTurn = {
  id: string;
  question: string;
  attachments: Attachment[];
  answer: AnswerResult | null;
  loadingAnswer: boolean;
  error: string | null;
  lesson: LessonResult | null;
  loadingLesson: boolean;
  lessonError: string | null;
};

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type UseChatOptions = {
  /**
   * Present when the user arrived at /chat straight from the landing page
   * search bar (?q=...). Sent exactly once, then the caller is notified via
   * onInitialQuestionSent so it can strip the param from the URL.
   */
  initialQuestion?: string;
  onInitialQuestionSent?: () => void;
  /**
   * Not used yet — plumbed through now so that once conversations are
   * persisted, ChatPage (mounted at /chat/:conversationId) can pass this
   * down and turns can be loaded from / written to a database keyed by it.
   */
  conversationId?: string;
};

/**
 * Owns the entire chat conversation: the running list of turns, the
 * composer state (input + pending attachments), and the two async actions
 * (asking a question, requesting the visual lesson for a given answer).
 *
 * `turns` is append-only — nothing here ever clears or resets it. The
 * input/attachments are cleared the instant a question is fired off, not
 * when the response comes back, and focus/scroll are re-synced via effects
 * keyed off the turns array so this hook works the same whether it's
 * seeded from a URL param or driven purely by user typing.
 */
export function useChat(options: UseChatOptions = {}) {
  const { initialQuestion, onInitialQuestionSent, conversationId } = options;

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasSentInitial = useRef(false);

  const addAttachments = useCallback((next: Attachment[]) => {
    setAttachments((prev) => [...prev, ...next]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const updateTurn = useCallback((id: string, patch: Partial<ChatTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const ask = useCallback(
    async (rawQuestion: string, turnAttachments: Attachment[] = []) => {
      const question = rawQuestion.trim();
      if (!question && turnAttachments.length === 0) return;

      // Snapshot conversation history from everything already answered,
      // before appending the new turn — same shape the backend expects.
      const history = turns
        .filter((t): t is ChatTurn & { answer: AnswerResult } => t.answer !== null)
        .map((t) => ({ question: t.question, answer: t.answer.answer }));

      const newTurn: ChatTurn = {
        id: makeId(),
        question,
        attachments: turnAttachments,
        answer: null,
        loadingAnswer: true,
        error: null,
        lesson: null,
        loadingLesson: false,
        lessonError: null,
      };

      setTurns((prev) => [...prev, newTurn]);

      try {
        const result = await generateAnswer({ data: { question, history } });
        updateTurn(newTurn.id, { answer: result, loadingAnswer: false });
        // TODO(persistence): once conversations are stored, write both the
        // question and `result` to the DB here, keyed by `conversationId`.
        // e.g. await saveTurn({ conversationId, turnId: newTurn.id, question, answer: result })
        void conversationId;
      } catch (err) {
        console.error(err);
        updateTurn(newTurn.id, {
          loadingAnswer: false,
          error: "Something went wrong answering that. Try again.",
        });
      }
    },
    [turns, updateTurn, conversationId]
  );

  /** Submits whatever is currently in the composer, then clears ONLY the
   *  composer — the conversation array is never touched by this. */
  const submitComposer = useCallback(() => {
    if (!input.trim() && attachments.length === 0) return;
    const q = input;
    const files = attachments;
    setInput("");
    setAttachments([]);
    void ask(q, files);
  }, [input, attachments, ask]);

  // Auto-send the question passed in from the landing page, exactly once.
  useEffect(() => {
    if (!initialQuestion || hasSentInitial.current) return;
    hasSentInitial.current = true;
    void ask(initialQuestion);
    onInitialQuestionSent?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  // Focus right after a question is submitted (new turn appended)...
  useEffect(() => {
    inputRef.current?.focus();
  }, [turns.length]);

  // ...and again once that turn's answer finishes loading, in case the
  // user clicked away while waiting.
  const lastLoading = turns[turns.length - 1]?.loadingAnswer;
  useEffect(() => {
    if (turns.length > 0 && lastLoading === false) {
      inputRef.current?.focus();
    }
  }, [lastLoading, turns.length]);

  // Smoothly scroll to the newest message whenever the conversation
  // changes shape — new question, streamed-in answer, or attached lesson.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const explainVisually = useCallback(
    async (turnId: string, question: string) => {
      updateTurn(turnId, { loadingLesson: true, lessonError: null });
      try {
        const result = await generateLesson({ data: { question } });
        updateTurn(turnId, { lesson: result, loadingLesson: false });
      } catch (err) {
        console.error(err);
        updateTurn(turnId, {
          loadingLesson: false,
          lessonError: "Something went wrong building that lesson. Try again.",
        });
      }
    },
    [updateTurn]
  );

  const isAsking = turns.some((t) => t.loadingAnswer);

  return {
    turns,
    input,
    setInput,
    attachments,
    addAttachments,
    removeAttachment,
    submitComposer,
    explainVisually,
    isAsking,
    inputRef,
    bottomRef,
  };
}

export type UseChatReturn = ReturnType<typeof useChat>;