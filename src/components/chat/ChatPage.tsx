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
    <div className="flex h-dvh flex-col bg-background">
      {/* minimal chat header — dedicated AI workspace, no marketing chrome */}
      <header className="flex flex-shrink-0 items-center gap-3 border-b bg-background/90 px-6 py-3 backdrop-blur">
        <Link to="/" className="font-display text-lg tracking-tight">
          ExplainAI
        </Link>
        <span className="text-xs text-muted-foreground">chat</span>
      </header>

      {/* scrollable conversation area */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <ConversationThread chat={chat} />
      </div>

      {/* sticky composer — always visible, ChatGPT-style */}
      <div className="flex-shrink-0 border-t bg-background/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <ChatComposer chat={chat} />
        </div>
      </div>
    </div>
  );
}