import { createServerFn } from "@tanstack/react-start";
import { searchTrustedSources, type SourceSnippet } from "./searchSources";

const NEWS_DOMAINS = [
  "bbc.com",
  "aljazeera.com",
  "cnn.com",
  "reuters.com",
  "apnews.com",
  "npr.org",
  "theguardian.com",
];

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function addOffset(base: Date, amount: number, unit: string): Date {
  const d = new Date(base);
  if (unit === "days") d.setDate(d.getDate() + amount);
  else if (unit === "weeks") d.setDate(d.getDate() + amount * 7);
  else if (unit === "months") d.setMonth(d.getMonth() + amount);
  else if (unit === "years") d.setFullYear(d.getFullYear() + amount);
  return d;
}

async function callGroqJson(messages: any[]) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
  const json = await response.json();
  try {
    return JSON.parse(json.choices[0].message.content);
  } catch {
    return null;
  }
}

type DateQuery =
  | { kind: "none" }
  | { kind: "offset"; amount: number; unit: "days" | "weeks" | "months" | "years"; direction: "future" | "past" }
  | { kind: "specificDate"; isoDate: string };

async function detectDateQuery(question: string): Promise<DateQuery> {
  const result = await callGroqJson([
    {
      role: "system",
      content: `Determine if the question is asking about date arithmetic (a date offset from today, or the day of the week for a specific date). Respond with ONLY JSON in one of these exact shapes:

{ "kind": "none" } — the question is not about date arithmetic.
{ "kind": "offset", "amount": number, "unit": "days" | "weeks" | "months" | "years", "direction": "future" | "past" } — question asks about a date N units before/after today (e.g. "41 years from now", "what date is 90 days from today", "3 weeks ago").
{ "kind": "specificDate", "isoDate": "YYYY-MM-DD" } — question asks what day of the week a specific already-known date falls on (e.g. "what day was July 14 2067", "what day of the week is Christmas 2030").

If genuinely unsure or it's not date-related at all, respond { "kind": "none" }.`,
    },
    { role: "user", content: question },
  ]);

  if (!result || typeof result.kind !== "string") return { kind: "none" };

  if (result.kind === "offset" && typeof result.amount === "number" && ["days", "weeks", "months", "years"].includes(result.unit)) {
    return {
      kind: "offset",
      amount: result.amount,
      unit: result.unit,
      direction: result.direction === "past" ? "past" : "future",
    };
  }

  if (result.kind === "specificDate" && typeof result.isoDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(result.isoDate)) {
    return { kind: "specificDate", isoDate: result.isoDate };
  }

  return { kind: "none" };
}

async function analyzeForSearch(
  question: string,
  todayIso: string
): Promise<{ needsSearch: boolean; searchQuery: string; isNews: boolean }> {
  const result = await callGroqJson([
    {
      role: "system",
      content: `Today's date is ${todayIso}. Determine if answering this question requires current/ongoing information (recent news, scores, results, prices, releases, outbreaks, political situations, or anything that could have changed after a knowledge cutoff).

Respond with ONLY JSON: { "needsSearch": true or false, "searchQuery": "...", "isNews": true or false }.

If "needsSearch" is true:
- Write "searchQuery" as a short, search-engine-friendly query focused on the SPECIFIC subject asked about (don't generalize it away). Replace any relative time words ("today", "yesterday", "this week", "recent") with the actual resolved date based on today's date above.
- Set "isNews" to true if this is specifically a news/current-events question — this triggers a dedicated news search restricted to reputable news outlets. Set it false for things like scores/prices/CEO lookups that aren't really "news" queries.

Example: today is 2026-07-29, question "give me real news updates of today" -> { "needsSearch": true, "searchQuery": "world news July 29 2026", "isNews": true }
Example: today is 2026-07-29, question "current covid situation in china" -> { "needsSearch": true, "searchQuery": "COVID-19 China outbreak July 2026", "isNews": true }

false examples: "what is 2+2", "explain photosynthesis", "capital of France" -> { "needsSearch": false, "searchQuery": "", "isNews": false }

When in doubt about whether a topic is ongoing/evolving vs. settled history, prefer needsSearch: true.`,
    },
    { role: "user", content: question },
  ]);

  return {
    needsSearch: Boolean(result?.needsSearch),
    searchQuery: typeof result?.searchQuery === "string" && result.searchQuery.trim() ? result.searchQuery : question,
    isNews: Boolean(result?.isNews),
  };
}

/** Cheap relevance check: does at least one retrieved snippet actually
 *  relate to the original question's subject, or did the search engine
 *  just return generic/unrelated results? Prevents the model from trying
 *  to answer using off-topic snippets instead of admitting it found nothing. */
async function snippetsAreRelevant(question: string, snippets: SourceSnippet[]): Promise<boolean> {
  const result = await callGroqJson([
    {
      role: "system",
      content: `A user asked a question, and a web search was performed. Below are the titles of the results found. Determine if AT LEAST ONE result is actually relevant to answering the question — not just topically adjacent, but genuinely about the subject asked.

Respond with ONLY JSON: { "relevant": true or false }.`,
    },
    {
      role: "user",
      content: `Question: ${question}\n\nResult titles:\n${snippets.map((s, i) => `${i + 1}. ${s.title}`).join("\n")}`,
    },
  ]);
  return Boolean(result?.relevant);
}

export type AnswerResult = {
  answer: string;
  sources: { title: string; url: string }[];
};

export const generateAnswer = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    data as {
      question: string;
      history?: { question: string; answer: string }[];
    }
  )
  .handler(async ({ data }): Promise<AnswerResult> => {
    const now = new Date();
    const today = formatDate(now);
    const todayIso = now.toISOString().slice(0, 10);

    let computedFact = "";
    let referenceBlock = "";
    let searchAttempted = false;
    let searchFoundNothingUseful = false;
    let searchQueryUsed = "";
    let usedSources: { title: string; url: string }[] = [];

    try {
      const dateQuery = await detectDateQuery(data.question);

      if (dateQuery.kind === "offset") {
        const signedAmount = dateQuery.direction === "past" ? -dateQuery.amount : dateQuery.amount;
        const resultDate = addOffset(now, signedAmount, dateQuery.unit);
        computedFact = `Computed fact (calculated precisely, not estimated): ${dateQuery.amount} ${dateQuery.unit} ${dateQuery.direction === "past" ? "before" : "from"} today (${today}) is exactly ${formatDate(resultDate)}. State this exact date and day of the week in your answer — do not recalculate or second-guess it.`;
      } else if (dateQuery.kind === "specificDate") {
        const parsed = new Date(dateQuery.isoDate + "T00:00:00");
        if (!isNaN(parsed.getTime())) {
          computedFact = `Computed fact (calculated precisely, not estimated): ${formatDate(parsed)}. State this exact day of the week in your answer — do not recalculate or second-guess it.`;
        }
      } else {
        const { needsSearch, searchQuery, isNews } = await analyzeForSearch(data.question, todayIso);

        if (needsSearch) {
          searchAttempted = true;
          searchQueryUsed = searchQuery;
          const snippets: SourceSnippet[] = await searchTrustedSources(
            searchQuery,
            isNews ? NEWS_DOMAINS : [],
            isNews ? { topic: "news", days: 2 } : { topic: "general" }
          );

          const relevant = snippets.length > 0 ? await snippetsAreRelevant(data.question, snippets) : false;

          if (relevant) {
            referenceBlock =
              `\n\nHere is current information retrieved from the web just now (search query used: "${searchQuery}"${isNews ? ", restricted to reputable news outlets" : ""}). Base your answer entirely on this — it is more current than anything you were trained on. Prefer snippets with the most recent publish dates. If results describe an event as upcoming/scheduled rather than completed, say so honestly rather than treating it as settled:\n\n` +
              snippets
                .map((s, i) => `[Result ${i + 1}]${s.publishedDate ? ` (published ${s.publishedDate})` : ""} ${s.title} (${s.url})\n${s.content}`)
                .join("\n\n");
            usedSources = snippets
              .filter((s) => s.url)
              .slice(0, 5)
              .map((s) => ({ title: s.title, url: s.url }));
          } else {
            searchFoundNothingUseful = true;
          }
        }
      }
    } catch (err) {
      console.error("Date/search detection failed, continuing without it:", err);
      if (searchAttempted && !referenceBlock) searchFoundNothingUseful = true;
    }

    const conversationMessages = (data.history ?? []).flatMap((h) => [
      { role: "user", content: h.question },
      { role: "assistant", content: h.answer },
    ]);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a friendly, clear tutor answering in a normal chat. Give a clear, direct, well-explained answer in a few short paragraphs. Plain text only, no markdown headers, no code fences unless the question is about code.

Today's date is ${today}. If asked about the current date, day, or year, answer directly using this — never say you don't have access to real-time information or a training cutoff.

You are not reliable at date arithmetic (adding years/months/days, or figuring out a day of the week) — never attempt to calculate this yourself.${computedFact ? "\n\n" + computedFact : " If the question requires calculating a date offset or a day of the week and no computed fact is provided below, say you're not confident in the exact day of the week without a calendar, but you can still state the resulting date if it's simple year/month arithmetic."}
${referenceBlock}
${searchAttempted && searchFoundNothingUseful ? `\n\nA web search (query: "${searchQueryUsed}") was attempted for this question but the results found were not actually relevant to what was asked (they were about unrelated topics). This question is about something current, ongoing, or time-sensitive. CRITICAL: do not answer from memory here, even partially. Do not describe what you recall from training as if it might still be true, and do not blend an old recollection with a disclaimer. Say plainly and only: you searched but couldn't find relevant, current information on this specific topic, and your training data may be outdated on it. You may suggest the person check a dedicated news source directly. Stop there — do not add "however, as of my knowledge..." or similar hedged recollections afterward.` : ""}

If earlier messages in this conversation are included below, use them as context for follow-up questions (e.g. "explain that differently", "what about the second part"), but always prioritize the most recent question as what you're actually answering.`,
          },
          ...conversationMessages,
          { role: "user", content: data.question },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Groq API error body:", errorBody);
      throw new Error(`Groq API error: ${response.status} - ${errorBody}`);
    }

    const json = await response.json();
    const answer = json.choices?.[0]?.message?.content as string;

    if (!answer) {
      throw new Error("No answer came back. Try asking again.");
    }

    return { answer, sources: usedSources };
  });