export type SourceSnippet = {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
};

export async function searchTrustedSources(
  query: string,
  domains: string[],
  options?: { topic?: "general" | "news"; days?: number }
): Promise<SourceSnippet[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      include_domains: domains.length > 0 ? domains : undefined,
      max_results: 6,
      topic: options?.topic ?? "general",
      days: options?.days,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Tavily API error body:", errorBody);
    throw new Error(`Tavily API error: ${response.status} - ${errorBody}`);
  }

  const json = await response.json();
  const results = Array.isArray(json.results) ? json.results : [];

  return results.map((r: any) => ({
    title: typeof r.title === "string" ? r.title : "Untitled source",
    url: typeof r.url === "string" ? r.url : "",
    content: typeof r.content === "string" ? r.content.slice(0, 800) : "",
    publishedDate: typeof r.published_date === "string" ? r.published_date : undefined,
  }));
  const NEWS_DOMAINS = [
  "bbc.com",
  "aljazeera.com",
  "cnn.com",
  "reuters.com",
  "apnews.com",
  "npr.org",
  "theguardian.com",
];
}
