import type { Tool } from "../types";
import { searchTrustedSources } from "../../searchSources";

export const searchEngine: Tool = {
  metadata: {
    name: "SearchEngine",
    description:
      "General, unrestricted web search — no domain filtering. Used for current events and time-sensitive facts.",
    whenToUse:
      "Question mentions recency ('today', 'latest', 'current', 'yesterday') or asks about something that could have changed after training data.",
    whenNeverToUse:
      "Stable, unchanging knowledge (math, established definitions, historical facts with fixed dates).",
    subjects: ["general"],
    priority: 9,
    canRunInParallel: true,
    optionalOnFailure: true,
    implemented: true,
  },
  async run(request) {
    const snippets = await searchTrustedSources(request.question, []);
    if (snippets.length === 0) {
      return {
        tool: "SearchEngine",
        success: true,
        summary: "No current results found.",
        data: [],
      };
    }
    const summary = snippets
      .map((s, i) => `[Result ${i + 1}] ${s.title} (${s.url})\n${s.content}`)
      .join("\n\n");
    return { tool: "SearchEngine", success: true, summary, data: snippets };
  },
};
