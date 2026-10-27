import type { UseChatReturn } from "@/hooks/useChat";
import { AttachMenu, AttachmentChips } from "@/components/site/AttachMenu";

export function ChatComposer({ chat }: { chat: UseChatReturn }) {
  return (
    <form
      className="w-full min-w-0"
      onSubmit={(e) => {
        e.preventDefault();
        chat.submitComposer();
      }}
    >
      <AttachmentChips attachments={chat.attachments} onRemove={chat.removeAttachment} />
      {chat.inputError ? <p id="chat-input-error" className="mb-2 px-3 text-sm text-destructive" role="alert">{chat.inputError}</p> : null}
      <div className="flex items-center gap-2 rounded-full border bg-background p-2 shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_50px_-30px_rgba(15,15,30,0.2)]">
        <AttachMenu onAdd={chat.addAttachments} />
        <input
          ref={chat.inputRef}
          value={chat.input}
          onChange={(e) => {
            if (e.target.value.length <= 2200) chat.setInput(e.target.value);
            else chat.setInput(e.target.value.slice(0, 2200));
          }}
          aria-invalid={Boolean(chat.inputError)}
          aria-describedby={chat.inputError ? "chat-input-error" : undefined}
          maxLength={2200}
          aria-label="Your question"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground"
          placeholder="Ask a follow-up…"
        />
        <button
          type="submit"
          disabled={chat.isAsking}
          className="inline-flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50 sm:px-5"
        >
          {chat.isAsking ? "Thinking…" : "Ask"}
        </button>
      </div>
    </form>
  );
}
