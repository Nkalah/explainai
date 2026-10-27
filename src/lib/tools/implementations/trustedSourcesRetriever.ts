import type { Tool } from "../types";
import { TRUSTED_DOMAINS } from "../../trustedSources";
import { searchTrustedSources } from "../../searchSources";

export const trustedSourcesRetriever: Tool = {
  metadata: {
    name: "TrustedSourcesRetriever",
    description:
      "Searches a curated set of trusted, subject-specific domains (OpenStax, Khan Academy, MDN, official docs, Britannica, etc.) for grounding material.",
    whenToUse:
      "Non-computational subjects (history, biology, geography, chemistry facts) where accuracy benefits from citing a real source.",
    whenNeverToUse:
      "Pure math/logic/programming questions with no external facts to verify, or elementary-level questions where citations add no value.",
    subjects: ["history", "geography", "biology", "chemistry", "physics", "general"],
    priority: 8,
    canRunInParallel: true,
    optionalOnFailure: true,
    implemented: true,
  },
  async run(request) {
    const subjectKey =
      (Object.keys(TRUSTED_DOMAINS) as (keyof typeof TRUSTED_DOMAINS)[]).find((k) =>
        request.plan.subject.toLowerCase().includes(k),
      ) ?? "other";

    const snippets = await searchTrustedSources(request.question, TRUSTED_DOMAINS[subjectKey]);

    if (snippets.length === 0) {
      return {
        tool: "TrustedSourcesRetriever",
        success: true,
        summary: "No relevant trusted sources found.",
        data: [],
      };
    }

    const summary = snippets
      .map((s, i) => `[Source ${i + 1}] ${s.title} (${s.url})\n${s.content}`)
      .join("\n\n");

    return { tool: "TrustedSourcesRetriever", success: true, summary, data: snippets };
  },
};
