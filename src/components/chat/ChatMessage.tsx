import { type AnswerResult } from "@/lib/generateAnswer";
import { LessonEngine } from "@/components/engine/LessonEngine";
import { AttachmentChips } from "@/components/site/AttachMenu";
import type { ChatTurn } from "@/hooks/useChat";

export function ChatMessage({
  turn,
  onExplainVisually,
}: {
  turn: ChatTurn;
  onExplainVisually: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* User bubble */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-foreground px-4 py-3 text-background">
          {turn.attachments.length > 0 && (
            <AttachmentChips attachments={turn.attachments} onRemove={() => {}} />
          )}
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{turn.question}</p>
        </div>
      </div>

      {/* AI bubble */}
      <div className="flex justify-start">
        <div className="w-full max-w-[85%] rounded-2xl rounded-tl-sm border bg-background p-5">
          {turn.loadingAnswer && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              Thinking…
            </div>
          )}

          {turn.error && <p className="text-sm text-red-500">{turn.error}</p>}

          {turn.answer && (
            <AnswerBlock
              answer={turn.answer}
              lesson={turn.lesson}
              loadingLesson={turn.loadingLesson}
              lessonError={turn.lessonError}
              question={turn.question}
              onExplainVisually={onExplainVisually}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AnswerBlock({
  answer,
  lesson,
  loadingLesson,
  lessonError,
  question,
  onExplainVisually,
}: {
  answer: AnswerResult;
  lesson: ChatTurn["lesson"];
  loadingLesson: boolean;
  lessonError: string | null;
  question: string;
  onExplainVisually: () => void;
}) {
  if (lesson) {
    return (
      <div>
        <LessonEngine lesson={lesson} question={question} />
        <div className="mt-4 flex items-center justify-between rounded-xl border bg-secondary/40 px-4 py-3 text-xs">
          <div>
            <span className="font-medium text-foreground">Confidence: {lesson.confidence}</span>
            {lesson.confidenceReason && (
              <span className="text-muted-foreground"> — {lesson.confidenceReason}</span>
            )}
          </div>
        </div>

        {lesson.sources.length > 0 && (
          <div className="mt-3 rounded-xl border bg-secondary/40 px-4 py-3 text-xs">
            <div className="mb-2 font-medium text-foreground">Sources used</div>
            <ul className="space-y-1">
              {lesson.sources.map((s) => (
                <li key={s.url}>
                  
                <a    href={s.url}
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
    );
  }

  return (
    <div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{answer.answer}</p>

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

      {lessonError && <p className="mt-3 text-sm text-red-500">{lessonError}</p>}

      <button
        onClick={onExplainVisually}
        disabled={loadingLesson}
        className="mt-5 inline-flex h-9 items-center gap-2 rounded-full border bg-secondary px-4 text-sm font-medium transition-colors hover:bg-secondary/70 disabled:opacity-50"
      >
        {loadingLesson ? "Building your lesson…" : "🎓 Show me a full visual lesson"}
      </button>
    </div>
  );
}