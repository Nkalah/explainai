import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import chatSystemPrompt from "../../prompts/chat_system_prompt.txt?raw";
import { callGroqText, type GroqMessage } from "./groqClient";

export type ChatMessageInput = {
  role: "user" | "assistant";
  content: string;
};

export type ChatReplyResult = {
  reply: string;
  visualizable: boolean;
  visual_topic: string;
  suggested_topics?: string[];
};

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

function parseChatReply(text: string): ChatReplyResult {
  const metaStart = text.lastIndexOf("<meta>");
  if (metaStart < 0) return { reply: text, visualizable: false, visual_topic: "", suggested_topics: [] };

  const metaEnd = text.indexOf("</meta>", metaStart + "<meta>".length);
  if (metaEnd < 0) {
    return { reply: text, visualizable: false, visual_topic: "", suggested_topics: [] };
  }

  try {
    const metadata: unknown = JSON.parse(text.slice(metaStart + 6, metaEnd));
    if (
      typeof metadata !== "object" ||
      metadata === null ||
      typeof (metadata as Record<string, unknown>).visualizable !== "boolean" ||
      typeof (metadata as Record<string, unknown>).visual_topic !== "string"
    ) {
      return { reply: text, visualizable: false, visual_topic: "", suggested_topics: [] };
    }

    const parsed = metadata as { visualizable: boolean; visual_topic: string; suggested_topics?: unknown };
    return {
      reply: text.slice(0, metaStart).trimEnd(),
      visualizable: parsed.visualizable,
      visual_topic: parsed.visualizable ? parsed.visual_topic : "",
      suggested_topics: Array.isArray(parsed.suggested_topics)
        ? parsed.suggested_topics
            .filter((topic): topic is string => typeof topic === "string")
            .map((topic) => topic.trim().slice(0, 80))
            .filter(Boolean)
            .slice(0, 2)
        : [],
    };
  } catch {
    return { reply: text, visualizable: false, visual_topic: "", suggested_topics: [] };
  }
}

const generateChatReplyServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.array(ChatMessageSchema).min(1).parse(data))
  .handler(async ({ data }): Promise<ChatReplyResult> => {
    const messages: GroqMessage[] = [
      { role: "system", content: chatSystemPrompt },
      ...data,
    ];
    const { text } = await callGroqText(messages);
    return parseChatReply(text);
  });

export async function generateChatReply(messages: ChatMessageInput[]): Promise<ChatReplyResult> {
  return generateChatReplyServerFn({ data: messages });
}
