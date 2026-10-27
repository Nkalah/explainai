import type { UseChatReturn } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";

export function ConversationThread({ chat }: { chat: UseChatReturn }) {
  if (chat.turns.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            New conversation
          </div>
          <h2 className="mt-3 font-display text-3xl">What would you like to learn?</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-6 py-10 text-left">
      {chat.turns.map((turn) => (
        <ChatMessage
          key={turn.id}
          turn={turn}
          onExplainVisually={() => chat.explainVisually(turn.id, turn.question)}
        />
      ))}
      {/* scroll sentinel — always the true bottom of the thread */}
      <div ref={chat.bottomRef} />
    </div>
  );
}