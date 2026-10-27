export class GroqRateLimitError extends Error {
  constructor(retryAfterText?: string) {
    super(
      retryAfterText
        ? `I'm getting a lot of questions right now — please try again in about ${retryAfterText}.`
        : "I'm getting a lot of questions right now — please try again in a few minutes.",
    );
    this.name = "GroqRateLimitError";
  }
}
