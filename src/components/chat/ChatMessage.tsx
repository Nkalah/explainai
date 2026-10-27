import { type ChatReplyResult } from "@/lib/generateChatReply";
import { lazy, Suspense } from "react";
import { AttachmentChips } from "@/components/site/AttachMenu";
import type { ChatTurn } from "@/hooks/useChat";
import type { LessonStepExplanationMode } from "@/lib/parseLesson";

const MarkdownAnswer = lazy(() => import("./ChatMarkdown"));
const LessonPlayer = lazy(() =>
  import("@/components/lesson/LessonPlayer").then((module) => ({ default: module.LessonPlayer })),
);

export function ChatMessage({
  turn,
  onExplainVisually,
  onExplainInText,
  onRetry,
  onAskFollowUp,
  onSuggestedTopic,
  onExplainLessonStep,
}: {
  turn: ChatTurn;
  onExplainVisually: (topic: string) => void;
  onExplainInText: (topic: string) => void;
  onRetry: () => void;
  onAskFollowUp: () => void;
  onSuggestedTopic: (topic: string) => void;
  onExplainLessonStep: (stepId: string, mode: LessonStepExplanationMode) => void;
}) {
  return (
    <article className="w-full min-w-0 space-y-4" aria-label="Conversation turn">
      {/* User bubble */}
      <div className="flex justify-end">
        <section
          aria-label="Your message"
          className="max-w-full rounded-2xl rounded-tr-sm bg-foreground px-4 py-3 text-background"
        >
          {turn.attachments.length > 0 && (
            <AttachmentChips attachments={turn.attachments} onRemove={() => {}} />
          )}
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading message…</p>}>
            <MarkdownAnswer content={turn.question} />
          </Suspense>
        </section>
      </div>

      {/* AI bubble */}
      <div className="flex justify-start">
        <section
          aria-label="ExplainAI response"
          className={`w-full min-w-0 max-w-full overflow-hidden ${turn.lesson ? "rounded-none border-0 bg-transparent p-0" : "rounded-2xl rounded-tl-sm border bg-background p-4 sm:p-5"}`}
        >
          {turn.loadingAnswer && (
            <div className="thinking-bubble" role="status" aria-label="Thinking">
              <span />
              <span />
              <span />
            </div>
          )}

          {turn.error && (
            <FailureCard
              title="I couldn't get that answer"
              cause={turn.error}
              onRetry={onRetry}
              onTextInstead={() => onExplainInText(turn.question)}
            />
          )}

          {turn.answer && (
            <AnswerBlock
              answer={turn.answer}
              lesson={turn.lesson}
              stepFollowUps={turn.stepFollowUps}
              loadingLesson={turn.loadingLesson}
              lessonError={turn.lessonError}
              fallbackTopic={turn.question}
              onExplainVisually={onExplainVisually}
              onExplainInText={onExplainInText}
              onRetry={onRetry}
              onAskFollowUp={onAskFollowUp}
              onSuggestedTopic={onSuggestedTopic}
              onExplainLessonStep={onExplainLessonStep}
            />
          )}
        </section>
      </div>
    </article>
  );
}

function AnswerBlock({
  answer,
  lesson,
  stepFollowUps,
  loadingLesson,
  lessonError,
  fallbackTopic,
  onExplainVisually,
  onExplainInText,
  onRetry,
  onAskFollowUp,
  onSuggestedTopic,
  onExplainLessonStep,
}: {
  answer: ChatReplyResult;
  lesson: ChatTurn["lesson"];
  stepFollowUps: ChatTurn["stepFollowUps"];
  loadingLesson: boolean;
  lessonError: string | null;
  fallbackTopic: string;
  onExplainVisually: (topic: string) => void;
  onExplainInText: (topic: string) => void;
  onRetry: () => void;
  onAskFollowUp: () => void;
  onSuggestedTopic: (topic: string) => void;
  onExplainLessonStep: (stepId: string, mode: LessonStepExplanationMode) => void;
}) {
  const visualTopic = answer.visual_topic || fallbackTopic;
  return (
    <div>
      {!lesson ? <MarkdownAnswer content={answer.reply} /> : null}

      {answer.visualizable && !lesson && !loadingLesson && (
        <button
          onClick={() => onExplainVisually(visualTopic)}
          disabled={loadingLesson}
          className="mt-4 inline-flex min-h-11 items-center rounded-full border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          {loadingLesson ? "Preparing illustration..." : "Show illustration"}
        </button>
      )}

      {loadingLesson ? <LessonSkeleton /> : null}

      {lessonError ? (
        <FailureCard
          title="Your lesson didn't come together"
          cause={lessonError}
          onRetry={() => onExplainVisually(visualTopic)}
          onTextInstead={() => onExplainInText(visualTopic)}
          disabled={loadingLesson}
        />
      ) : null}

      {lesson && (
        <div className="mt-5">
          <Suspense fallback={<LessonSkeleton />}>
            <LessonPlayer
              lesson={lesson as Parameters<typeof LessonPlayer>[0]["lesson"]}
              suggestedTopics={answer.suggested_topics}
              onAskFollowUp={onAskFollowUp}
              onSuggestedTopic={onSuggestedTopic}
              stepFollowUps={stepFollowUps}
              onExplainStep={onExplainLessonStep}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

function FailureCard({
  title,
  cause,
  onRetry,
  onTextInstead,
  disabled = false,
}: {
  title: string;
  cause: string;
  onRetry: () => void;
  onTextInstead: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="state-card mt-3" role="alert">
      <h2>{title}</h2>
      <p>{cause}</p>
      <div className="state-card-actions">
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          onClick={onRetry}
          disabled={disabled}
        >
          Retry
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--secondary"
          onClick={onTextInstead}
          disabled={disabled}
        >
          Explain in text instead
        </button>
      </div>
    </section>
  );
}

function LessonSkeleton() {
  return (
    <div className="lesson-skeleton mt-4" role="status" aria-label="Preparing your lesson">
      <p>Preparing your lesson…</p>
      <div className="lesson-skeleton-stage" />
      <div className="lesson-skeleton-copy">
        <span />
        <span />
        <span />
      </div>
      <div className="lesson-skeleton-controls">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
