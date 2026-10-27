import type { UseChatReturn } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";

export function ConversationThread({ chat }: { chat: UseChatReturn }) {
  if (chat.turns.length === 0) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-6 py-8 text-center">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            New conversation
          </div>
          <h2 className="mt-3 font-display text-3xl">What would you like to learn?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Ask a question and we’ll work through it together.
          </p>
          <div className="mx-auto mt-6 grid w-full max-w-lg gap-2 text-left">
            {[
              "Why does dividing by a fraction make a number bigger?",
              "How do plants turn sunlight into food?",
              "How does a refrigerator keep food cold?",
            ].map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => chat.askQuestion(question)}
                className="ds-btn ds-btn--secondary h-auto justify-start whitespace-normal rounded-xl px-4 py-3 text-left"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-6 text-left sm:space-y-10 sm:px-6 sm:py-10">
      {chat.turns.map((turn) => (
        <ChatMessage
          key={turn.id}
          turn={turn}
          onExplainVisually={(topic) => chat.explainVisually(turn.id, topic)}
          onExplainInText={(topic) => chat.explainInText(turn.id, topic)}
          onRetry={() => chat.retryAnswer(turn.id)}
          onAskFollowUp={chat.focusComposer}
          onSuggestedTopic={chat.askQuestion}
          onExplainLessonStep={(stepId, mode) => chat.explainLessonStep(turn.id, stepId, mode)}
        />
      ))}
      {/* scroll sentinel — always the true bottom of the thread */}
      <div ref={chat.bottomRef} />
    </div>
  );
}
