import { GroqRateLimitError } from "./groqRateLimitError";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GroqJsonResult = {
  data: Record<string, unknown> | null;
  raw?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export class GroqJsonValidationError extends Error {
  constructor(public readonly failedGeneration?: string) {
    super("Groq rejected the generated response as invalid JSON.");
    this.name = "GroqJsonValidationError";
  }
}

function extractRetryAfterMs(headers: Headers, errorBody: string): number {
  const headerValue = headers.get("retry-after");
  if (headerValue) {
    const parsed = Number(headerValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.ceil(parsed) * 1000;
    }
  }

  const match = errorBody.match(/try again in ([\d.]+)(m|s|h)/i);
  if (match) {
    const amount = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === "h") return Math.ceil(amount * 60 * 1000);
    if (unit === "m") return Math.ceil(amount * 60 * 1000);
    return Math.ceil(amount * 1000);
  }

  return 0;
}

export async function callGroqJson(
  messages: GroqMessage[],
  retryCount = 0,
): Promise<GroqJsonResult> {
  return callGroq(messages, { jsonMode: true, retryCount });
}

export async function callGroqText(
  messages: GroqMessage[],
  retryCount = 0,
): Promise<{ text: string; usage?: GroqJsonResult["usage"] }> {
  const { data, usage } = await callGroq(messages, { jsonMode: false, retryCount });
  return { text: (data as { text?: string } | null)?.text ?? "", usage };
}

interface CallGroqOptions {
  jsonMode: boolean;
  retryCount: number;
}

async function callGroq(
  messages: GroqMessage[],
  options: CallGroqOptions,
): Promise<GroqJsonResult> {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(60000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });

  if (response.status === 429) {
    const errorBody = await response.text();
    const retryAfterMs = extractRetryAfterMs(response.headers, errorBody);
    const nextRetry = options.retryCount + 1;

    if (nextRetry <= MAX_RETRIES) {
      const delay =
        retryAfterMs > 0
          ? Math.min(retryAfterMs + 500, 30000)
          : Math.min(BASE_DELAY_MS * Math.pow(2, options.retryCount - 1), 30000);

      console.error(
        `Groq rate limited (attempt ${nextRetry}/${MAX_RETRIES}). Retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callGroq(messages, { ...options, retryCount: nextRetry });
    }

    const friendlyText =
      retryAfterMs > 0
        ? `I'm getting a lot of questions right now — please try again in about ${Math.ceil(retryAfterMs / 1000)} seconds.`
        : "I'm getting a lot of questions right now — please try again in a few minutes.";
    throw new GroqRateLimitError(friendlyText);
  }

  if (!response.ok) {
    const errorBody = await response.text();

    if (response.status === 400) {
      let errorJson: unknown;
      try {
        errorJson = JSON.parse(errorBody);
      } catch {
        errorJson = null;
      }

      if (
        options.jsonMode &&
        isRecord(errorJson) &&
        isRecord(errorJson.error) &&
        errorJson.error.code === "json_validate_failed"
      ) {
        throw new GroqJsonValidationError(
          typeof errorJson.error.failed_generation === "string"
            ? errorJson.error.failed_generation
            : undefined,
        );
      }
    }

    console.error("Groq API error:", response.status, errorBody);
    throw new Error(`Groq API error: ${response.status} - ${errorBody}`);
  }

  const json = await response.json();
  const raw = json.choices?.[0]?.message?.content as string | undefined;

  if (!raw) {
    return { data: null, usage: json.usage };
  }

  if (options.jsonMode) {
    let data: Record<string, unknown> | null = null;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("Failed to parse Groq JSON response:", raw);
    }
    return { data, raw, usage: json.usage };
  }

  return { data: { text: raw } as Record<string, unknown>, usage: json.usage };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
