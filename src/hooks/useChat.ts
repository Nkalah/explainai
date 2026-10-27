import { useCallback, useEffect, useRef, useState } from "react";
import { generateAnswer } from "@/lib/generateAnswer";
import { generateStepExplanation } from "@/lib/generateStepExplanation";
import {
  generateChatReply,
  type ChatMessageInput,
  type ChatReplyResult,
} from "@/lib/generateChatReply";
import { GroqRateLimitError } from "@/lib/groqRateLimitError";
import {
  parseLesson,
  type LessonScript,
  type LessonStepExplanationMode,
  type LessonStepExplanationState,
} from "@/lib/parseLesson";
import type { Attachment } from "@/components/site/AttachMenu";

export type ChatTurn = {
  id: string;
  question: string;
  lessonQuestion: string;
  lessonContext: ChatMessageInput[];
  attachments: Attachment[];
  answer: ChatReplyResult | null;
  loadingAnswer: boolean;
  error: string | null;
  lesson: LessonScript | null;
  loadingLesson: boolean;
  lessonError: string | null;
  lessonErrorKind: "invalid" | "rate-limit" | "offline" | "timeout" | "server" | null;
  stepFollowUps: Record<
    string,
    Partial<Record<LessonStepExplanationMode, LessonStepExplanationState>>
  >;
};

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function lessonFailureKind(error: unknown): ChatTurn["lessonErrorKind"] {
  if (error instanceof GroqRateLimitError) return "rate-limit";
  if (error instanceof Error && /rate.?limit|429|too many requests|busy/i.test(error.message))
    return "rate-limit";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  if (error instanceof DOMException && error.name === "AbortError") return "timeout";
  if (error instanceof Error && /timed?\s*out|timeout/i.test(error.message)) return "timeout";
  if (error instanceof Error && /network|fetch failed|connection/i.test(error.message))
    return "offline";
  if (
    error instanceof Error &&
    /invalid|JSON|format|analysis|verified answer|exact question/i.test(error.message)
  )
    return "invalid";
  if (error instanceof TypeError) return "offline";
  return "server";
}

function lessonFailureMessage(error: unknown): string {
  switch (lessonFailureKind(error)) {
    case "rate-limit":
      return "The lesson service is busy right now.";
    case "offline":
      return "Your connection dropped before the lesson finished.";
    case "timeout":
      return "The lesson took too long to prepare.";
    case "invalid":
      return "Couldn't generate this lesson, please try again.";
    default:
      return "Couldn't generate this lesson, please try again.";
  }
}

function answerFailureMessage(error: unknown): string {
  if (error instanceof GroqRateLimitError)
    return "The service is busy right now. Please try again shortly.";
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return "Your connection dropped before we could answer.";
  if (error instanceof DOMException && error.name === "TimeoutError")
    return "The answer took too long to arrive.";
  if (error instanceof Error && /timed?\s*out|timeout/i.test(error.message))
    return "The answer took too long to arrive.";
  if (error instanceof TypeError) return "We couldn't connect to the answer service.";
  return "The answer service had a problem. Please try again.";
}

function isNetworkFailure(error: unknown): boolean {
  return (
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    error instanceof TypeError ||
    (error instanceof Error && /network|fetch failed|connection/i.test(error.message))
  );
}

function parseCalendarDate(topic: string) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthExpression = months.join("|");
  const dayFirst = topic.match(
    new RegExp(`\\b(\\d{1,2})\\s+(${monthExpression})\\s+(\\d{4})\\b`, "i"),
  );
  const monthFirst = topic.match(
    new RegExp(`\\b(${monthExpression})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i"),
  );
  const iso = topic.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);

  let year: number;
  let month: number;
  let day: number;
  if (dayFirst) {
    day = Number(dayFirst[1]);
    month = months.findIndex((name) => name.toLowerCase() === dayFirst[2].toLowerCase()) + 1;
    year = Number(dayFirst[3]);
  } else if (monthFirst) {
    month = months.findIndex((name) => name.toLowerCase() === monthFirst[1].toLowerCase()) + 1;
    day = Number(monthFirst[2]);
    year = Number(monthFirst[3]);
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return { year, month, day, date };
}

function ensureWeekdayVisuals(lesson: LessonScript, topic: string): LessonScript {
  if (!/\b(?:weekday|week\s*day|calendar|date|day of the week)\b/i.test(topic)) return lesson;
  if (!/\b(?:weekday|week\s*day|day of the week)\b/i.test(lesson.solution.find)) return lesson;
  const targetDate = parseCalendarDate(topic);
  if (!targetDate) return lesson;

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const anchor = new Date(Date.UTC(2000, 0, 1));
  const targetYearStart = new Date(Date.UTC(targetDate.year, 0, 1));
  const countLeapYearsBefore = (year: number) =>
    Math.floor((year - 1) / 4) - Math.floor((year - 1) / 100) + Math.floor((year - 1) / 400);
  const leapDays = countLeapYearsBefore(targetDate.year) - countLeapYearsBefore(2000);
  const cycleMoves = targetDate.year - 2000 + leapDays;
  const anchorWeekday = (anchor.getUTCDay() + 6) % 7;
  const targetWeekday = (targetDate.date.getUTCDay() + 6) % 7;
  if (!new RegExp(`\\b${weekdays[targetWeekday]}\\b`, "i").test(lesson.solution.answer)) {
    return lesson;
  }
  const daysFromYearStart = Math.round(
    (targetDate.date.getTime() - targetYearStart.getTime()) / 86400000,
  );
  const cycleSceneIndex = Math.min(1, lesson.scenes.length - 1);
  const calendarSceneIndex = Math.min(2, lesson.scenes.length - 1);

  return {
    ...lesson,
    scenes: lesson.scenes.map((scene, index) => {
      const actions = scene.actions.filter(
        (action) =>
          !(
            typeof action === "object" &&
            action !== null &&
            "do" in action &&
            (action.do === "cycleWheel" || action.do === "calendarGrid")
          ),
      );
      const withVisualDefaults = {
        ...scene,
        view: { ...scene.view, axes: false, grid: false },
        actions,
      };

      if (index === cycleSceneIndex) {
        return {
          ...withVisualDefaults,
          caption: "The weekday cycle repeats every seven days",
          narration: `The year starts on ${weekdays[anchorWeekday]} in 2000. After ${Math.abs(cycleMoves)} weekday steps, the year starts on ${weekdays[(anchorWeekday + (cycleMoves % 7) + 7) % 7]}. Only the remainder after dividing by seven matters.`,
          equation: { latex: `${cycleMoves}\\equiv${((cycleMoves % 7) + 7) % 7}\\pmod{7}` },
          actions: [
            ...actions,
            {
              t: 0.15,
              dur: Math.max(2, scene.duration - 0.4),
              do: "cycleWheel",
              slots: weekdays,
              marker: weekdays[anchorWeekday],
              moveBy: cycleMoves,
            },
          ],
        };
      }

      if (index === calendarSceneIndex) {
        return {
          ...withVisualDefaults,
          caption: `${monthNames[targetDate.month - 1]} ${targetDate.year} calendar`,
          narration: `The year begins on ${weekdays[(anchorWeekday + (cycleMoves % 7) + 7) % 7]}. ${targetDate.day} ${monthNames[targetDate.month - 1]} is ${daysFromYearStart} days after January 1; ${daysFromYearStart} divided by seven leaves remainder ${daysFromYearStart % 7}, landing on ${weekdays[targetWeekday]}.`,
          equation: { latex: `${daysFromYearStart}\\equiv${daysFromYearStart % 7}\\pmod{7}` },
          actions: [
            ...actions,
            {
              t: 0.15,
              dur: Math.min(1.4, Math.max(0.6, scene.duration - 0.2)),
              do: "calendarGrid",
              year: targetDate.year,
              month: targetDate.month,
              highlightDay: targetDate.day,
              highlightColor: "yellow",
            },
          ],
        };
      }

      return withVisualDefaults;
    }),
  };
}

// Caps how many prior Q&A turns get sent as context on each new question.
// This is the main lever against the Groq 8000 TPM limit — uncapped
// history is why token usage climbed with every turn. Tune this down if
// you're still hitting 429s, or up if answers start losing context.
const MAX_HISTORY_TURNS = 6;
const EXPLICIT_VISUAL_REQUEST =
  /\b(?:show|draw|demonstrate|illustrate|visuali[sz](?:e|ation)|visual(?:ly| form| explanation))\b|\bin visual form\b/i;
const CONTEXTUAL_VISUAL_FOLLOW_UP =
  /^(?:please\s+)?(?:(?:can|could)\s+you\s+)?(?:show|draw|demonstrate|illustrate|visuali[sz]e|do)\s+(?:me\s+)?(?:it|this|that|the answer|the solution|your explanation)(?:\s+(?:visually|in visual form|as a diagram|as an illustration))?[?.!]*$/i;

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

function boundLessonContext(messages: ChatMessageInput[]): ChatMessageInput[] {
  return messages.slice(-MAX_HISTORY_TURNS * 2).map((message) => ({
    ...message,
    content: message.content.slice(0, 8000),
  }));
}

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
  const [inputError, setInputError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [hasNetworkFailure, setHasNetworkFailure] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasSentInitial = useRef(false);
  const lessonRequestsInFlight = useRef(new Set<string>());
  const completedLessonRequests = useRef(new Set<string>());

  const addAttachments = useCallback((next: Attachment[]) => {
    setAttachments((prev) => [...prev, ...next]);
  }, []);

  useEffect(() => {
    const updateOnline = () => {
      setIsOnline(navigator.onLine);
      if (!navigator.onLine) setHasNetworkFailure(true);
    };
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
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

  const parseLessonFromAnswer = useCallback(
    (answerText: string, expectedQuestion: string): LessonScript | null => {
      try {
        return parseLesson(answerText, expectedQuestion);
      } catch {
        return null;
      }
    },
    [],
  );

  const buildLesson = useCallback(
    async (
      turnId: string,
      question: string,
      referenceAnswer: string,
      conversationContext: ChatMessageInput[] = [],
    ) => {
      if (lessonRequestsInFlight.current.has(turnId) || completedLessonRequests.current.has(turnId))
        return;
      lessonRequestsInFlight.current.add(turnId);
      updateTurn(turnId, { loadingLesson: true, lessonError: null, lessonErrorKind: null });

      try {
        const result = await generateAnswer(question, referenceAnswer, conversationContext);
        if (result.error) {
          console.error("Lesson generation API failed:", result.error);
          throw new Error(result.error);
        }
        const parsedLesson = parseLessonFromAnswer(result.answer, question);
        if (!parsedLesson) throw new Error("The lesson response was invalid.");
        const lesson = ensureWeekdayVisuals(parsedLesson, question);

        updateTurn(turnId, {
          lesson,
          loadingLesson: false,
          lessonError: null,
          lessonErrorKind: null,
        });
        setHasNetworkFailure(false);
        completedLessonRequests.current.add(turnId);
      } catch (error) {
        console.error(error);
        if (isNetworkFailure(error)) setHasNetworkFailure(true);
        updateTurn(turnId, {
          lesson: null,
          loadingLesson: false,
          lessonError: lessonFailureMessage(error),
          lessonErrorKind: lessonFailureKind(error),
        });
      } finally {
        lessonRequestsInFlight.current.delete(turnId);
      }
    },
    [parseLessonFromAnswer, updateTurn],
  );

  const ask = useCallback(
    async (rawQuestion: string, turnAttachments: Attachment[] = []) => {
      const question = rawQuestion.trim();
      if (!question && turnAttachments.length === 0) return;

      // Snapshot conversation history from everything already answered,
      // before appending the new turn — same shape the backend expects.
      // Trimmed to the most recent MAX_HISTORY_TURNS so token usage per
      // request stays bounded instead of growing with the whole thread.
      const messages: ChatMessageInput[] = turns
        .filter((turn) => turn.answer !== null)
        .slice(-MAX_HISTORY_TURNS)
        .flatMap((turn) => [
          { role: "user", content: turn.question },
          { role: "assistant", content: turn.answer!.reply },
        ]);
      messages.push({ role: "user", content: question });
      const lessonContext = boundLessonContext(messages.slice(0, -1));

      const newTurn: ChatTurn = {
        id: makeId(),
        question,
        lessonQuestion: question,
        lessonContext,
        attachments: turnAttachments,
        answer: null,
        loadingAnswer: true,
        error: null,
        lesson: null,
        loadingLesson: false,
        lessonError: null,
        lessonErrorKind: null,
        stepFollowUps: {},
      };

      setTurns((prev) => [...prev, newTurn]);

      try {
        const result = await generateChatReply(messages);
        const wantsLesson = EXPLICIT_VISUAL_REQUEST.test(question);
        const shouldBuildLesson = wantsLesson || result.visualizable;
        const previousTurn = turns.at(-1);
        const contextualVisualRequest =
          wantsLesson && CONTEXTUAL_VISUAL_FOLLOW_UP.test(question) && previousTurn;
        const dateQuestion = parseCalendarDate(question) ? question : null;
        const lessonQuestion = contextualVisualRequest
          ? previousTurn.lessonQuestion || previousTurn.question
          : question;
        const lessonAnswer = result.reply;
        const visualTopic = dateQuestion || result.visual_topic || question;
        updateTurn(newTurn.id, {
          answer: {
            ...result,
            visualizable: result.visualizable && !shouldBuildLesson,
            visual_topic: visualTopic,
          },
          lessonQuestion,
          lesson: null,
          loadingAnswer: false,
          loadingLesson: shouldBuildLesson,
          lessonError: null,
          lessonErrorKind: null,
        });
        setHasNetworkFailure(false);
        if (shouldBuildLesson) {
          await buildLesson(newTurn.id, lessonQuestion, lessonAnswer, lessonContext);
        }
        // TODO(persistence): once conversations are stored, write both the
        // question and `result` to the DB here, keyed by `conversationId`.
        // e.g. await saveTurn({ conversationId, turnId: newTurn.id, question, answer: result })
        void conversationId;
      } catch (err) {
        console.error(err);
        if (isNetworkFailure(err)) setHasNetworkFailure(true);

        updateTurn(newTurn.id, {
          loadingAnswer: false,
          error: answerFailureMessage(err),
        });
      }
    },
    [turns, updateTurn, conversationId, buildLesson],
  );

  const isAsking = turns.some((t) => t.loadingAnswer);

  const retryAnswer = useCallback(
    async (turnId: string) => {
      const turn = turns.find((item) => item.id === turnId);
      if (!turn || turn.loadingAnswer) return;
      const messages: ChatMessageInput[] = turns
        .filter((item) => item.id !== turnId && item.answer !== null)
        .slice(-MAX_HISTORY_TURNS)
        .flatMap((item) => [
          { role: "user", content: item.question },
          { role: "assistant", content: item.answer!.reply },
        ]);
      messages.push({ role: "user", content: turn.question });
      const lessonContext = boundLessonContext(messages.slice(0, -1));
      updateTurn(turnId, { loadingAnswer: true, error: null });
      try {
        const result = await generateChatReply(messages);
        const wantsLesson = EXPLICIT_VISUAL_REQUEST.test(turn.question);
        const shouldBuildLesson = wantsLesson || result.visualizable;
        const previousTurn = turns.filter((item) => item.id !== turnId).at(-1);
        const contextualVisualRequest =
          wantsLesson && CONTEXTUAL_VISUAL_FOLLOW_UP.test(turn.question) && previousTurn;
        const lessonQuestion = contextualVisualRequest
          ? previousTurn.lessonQuestion || previousTurn.question
          : turn.question;
        updateTurn(turnId, {
          answer: {
            ...result,
            visualizable: result.visualizable && !shouldBuildLesson,
            visual_topic: result.visual_topic || turn.question,
          },
          lessonQuestion,
          lessonContext,
          loadingLesson: shouldBuildLesson,
          loadingAnswer: false,
          lessonError: null,
          lessonErrorKind: null,
        });
        setHasNetworkFailure(false);
        if (shouldBuildLesson) {
          const lessonAnswer = result.reply;
          await buildLesson(turnId, lessonQuestion, lessonAnswer, lessonContext);
        }
      } catch (error) {
        console.error(error);
        if (isNetworkFailure(error)) setHasNetworkFailure(true);
        updateTurn(turnId, {
          loadingAnswer: false,
          error: answerFailureMessage(error),
        });
      }
    },
    [turns, updateTurn, buildLesson],
  );

  /** Submits whatever is currently in the composer, then clears ONLY the
   *  composer — the conversation array is never touched by this. */
  const submitComposer = useCallback(() => {
    if (!input.trim() && attachments.length === 0) {
      setInputError("Add a question or attachment to get started.");
      return;
    }
    if (input.trim().length > 2000) {
      setInputError("Keep your question to 2,000 characters or fewer.");
      return;
    }
    setInputError(null);
    if (isAsking) return;
    const q = input;
    const files = attachments;
    setInput("");
    setAttachments([]);
    void ask(q, files);
  }, [input, attachments, ask, isAsking]);

  const explainInText = useCallback(
    (turnId: string, topic: string) => {
      updateTurn(turnId, { error: null, lessonError: null, lessonErrorKind: null });
      void ask(`Explain ${topic} in text only, without creating a visual lesson.`);
    },
    [ask, updateTurn],
  );

  const askQuestion = useCallback(
    (question: string) => {
      void ask(question);
    },
    [ask],
  );

  const focusComposer = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const prepareFollowUp = useCallback((topic?: string) => {
    if (topic) setInput(topic);
    inputRef.current?.focus();
  }, []);

  const retryFailedRequests = useCallback(() => {
    for (const turn of turns) {
      if (turn.error) void retryAnswer(turn.id);
      else if (turn.lessonError) {
        void buildLesson(
          turn.id,
          turn.lessonQuestion || turn.question,
          turn.answer?.reply ?? "",
          turn.lessonContext,
        );
      }
    }
  }, [turns, retryAnswer, buildLesson]);

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
    (turnId: string, _topic: string) => {
      const turn = turns.find((item) => item.id === turnId);
      if (!turn?.answer) return;
      const turnIndex = turns.findIndex((item) => item.id === turnId);
      const conversationContext = boundLessonContext(
        turns
          .slice(0, turnIndex)
          .filter((item) => item.answer !== null)
          .flatMap((item) => [
            { role: "user" as const, content: item.question },
            { role: "assistant" as const, content: item.answer!.reply },
          ]),
      );
      void buildLesson(
        turnId,
        turn.lessonQuestion || turn.question,
        turn.answer.reply,
        conversationContext,
      );
    },
    [buildLesson, turns],
  );

  const explainLessonStep = useCallback(
    async (turnId: string, stepId: string, mode: LessonStepExplanationMode) => {
      const turn = turns.find((item) => item.id === turnId);
      const lesson = turn?.lesson;
      if (!lesson) return;
      const step = lesson.solution.steps.find((item) => item.id === stepId);
      if (!step) return;
      if (turn.stepFollowUps[stepId]?.[mode]?.loading) return;

      const updateStepFollowUp = (state: LessonStepExplanationState) => {
        setTurns((previous) =>
          previous.map((item) =>
            item.id === turnId
              ? {
                  ...item,
                  stepFollowUps: {
                    ...item.stepFollowUps,
                    [stepId]: {
                      ...item.stepFollowUps[stepId],
                      [mode]: state,
                    },
                  },
                }
              : item,
          ),
        );
      };

      updateStepFollowUp({ loading: true });
      try {
        const explanation = await generateStepExplanation(lesson.solution, stepId, mode);
        updateStepFollowUp({ loading: false, explanation });
      } catch (error) {
        console.error("Focused lesson-step explanation failed:", error);
        if (isNetworkFailure(error)) setHasNetworkFailure(true);
        updateStepFollowUp({
          loading: false,
          error: "I couldn't explain this step right now. Please try again.",
        });
      }
    },
    [turns],
  );

  return {
    turns,
    input,
    setInput: (value: string) => {
      setInput(value);
      if (value.trim().length <= 2000) setInputError(null);
    },
    inputError,
    attachments,
    addAttachments,
    removeAttachment,
    submitComposer,
    explainVisually,
    explainInText,
    askQuestion,
    focusComposer,
    prepareFollowUp,
    retryAnswer,
    retryFailedRequests,
    explainLessonStep,
    isAsking,
    isOnline,
    hasNetworkFailure,
    inputRef,
    bottomRef,
  };
}

export type UseChatReturn = ReturnType<typeof useChat>;
