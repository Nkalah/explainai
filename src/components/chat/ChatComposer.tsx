import type { UseChatReturn } from "@/hooks/useChat";
import { AttachMenu, AttachmentChips } from "@/components/site/AttachMenu";

export function ChatComposer({ chat }: { chat: UseChatReturn }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        chat.submitComposer();
      }}
    >
      <AttachmentChips attachments={chat.attachments} onRemove={chat.removeAttachment} />
      <div className="flex items-center gap-2 rounded-full border bg-background p-2 shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_50px_-30px_rgba(15,15,30,0.2)]">
        <AttachMenu onAdd={chat.addAttachments} />
        <input
          ref={chat.inputRef}
          value={chat.input}
          onChange={(e) => chat.setInput(e.target.value)}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted-foreground"
          placeholder="Ask a follow-up…"
        />
        <button
          type="submit"
          disabled={chat.isAsking}
          className="inline-flex h-10 flex-shrink-0 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {chat.isAsking ? "Thinking…" : "Ask"}
        </button>
      </div>
    </form>
  );
}