import { Link } from "@tanstack/react-router";
import { useChat } from "@/hooks/useChat";
import { ConversationThread } from "./ConversationThread";
import { ChatComposer } from "./ChatComposer";

export function ChatPage({
  initialQuestion,
  onInitialQuestionSent,
  conversationId,
}: {
  initialQuestion?: string;
  onInitialQuestionSent?: () => void;
  /** Reserved for /chat/:conversationId — loads/persists a specific thread. */
  conversationId?: string;
}) {
  const chat = useChat({ initialQuestion, onInitialQuestionSent, conversationId });

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      {/* minimal chat header — dedicated AI workspace, no marketing chrome */}
      <header className="flex flex-shrink-0 items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <nav aria-label="Main navigation" className="flex items-center gap-3">
          <Link to="/" className="font-display text-lg tracking-tight">
            ExplainAI
          </Link>
          <span className="text-xs text-muted-foreground">chat</span>
        </nav>
      </header>

      {/* scrollable conversation area */}
      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <h1 className="sr-only">ExplainAI chat</h1>
        {!chat.isOnline || chat.hasNetworkFailure ? (
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-3 sm:px-6" role="status">
            <p className="text-sm text-muted-foreground">You're offline. Your messages are safe here.</p>
            <button
              type="button"
              onClick={chat.retryFailedRequests}
              className="ds-btn ds-btn--secondary"
            >
              Retry
            </button>
          </div>
        ) : null}
        <ConversationThread chat={chat} />
      </main>

      {/* sticky composer — always visible, ChatGPT-style */}
      <div className="sticky bottom-0 z-30 flex-shrink-0 border-t bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="mx-auto max-w-3xl">
          <ChatComposer chat={chat} />
        </div>
      </div>
    </div>
  );
}
