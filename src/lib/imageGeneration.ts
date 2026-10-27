import { callGroqJson } from "./groqClient";
import type { SceneImage, VisualStrategy, SceneImageSource } from "@/lib/engineTypes";

const imageCache = new Map<string, { svg: string; prompt: string; strategy: VisualStrategy; source: SceneImageSource }>();

export function getCachedImage(cacheKey: string) {
  return imageCache.get(cacheKey);
}

export function setCachedImage(cacheKey: string, value: { svg: string; prompt: string; strategy: VisualStrategy; source: SceneImageSource }) {
  imageCache.set(cacheKey, value);
}

export async function generateSceneImage(
  subject: string,
  sceneTitle: string,
  narration: string,
  visualFocus: string,
  strategy: VisualStrategy,
): Promise<SceneImage> {
  const cacheKey = `${subject}::${sceneTitle}::${visualFocus}::${strategy}`;
  const cached = getCachedImage(cacheKey);
  if (cached) {
    return {
      url: `data:image/svg+xml;base64,${btoa(cached.svg)}`,
      prompt: cached.prompt,
      alt: sceneTitle,
      source: cached.source,
      strategy: cached.strategy,
    };
  }

  const prompt = buildImagePrompt(subject, sceneTitle, narration, visualFocus, strategy);
  const svg = await generateSvgDiagram(subject, sceneTitle, narration, visualFocus, strategy, prompt);

  const source: SceneImageSource = svg ? "generated-svg" : "fallback-svg";
  setCachedImage(cacheKey, { svg: svg || buildFallbackSvg(sceneTitle, visualFocus), prompt, strategy, source });

  return {
    url: `data:image/svg+xml;base64,${btoa(svg || buildFallbackSvg(sceneTitle, visualFocus))}`,
    prompt,
    alt: sceneTitle,
    source,
    strategy,
  };
}

function buildImagePrompt(
  subject: string,
  sceneTitle: string,
  narration: string,
  visualFocus: string,
  strategy: VisualStrategy,
): string {
  const strategyHints: Record<VisualStrategy, string> = {
    "whiteboard-only": "Clean whiteboard layout with large centered text",
    "image-primary": "Full educational illustration showing the main concept with clear labels",
    "image-annotation": "Base image with numbered callout annotations pointing to key parts",
    "diagram-overlay": "Transparent diagram overlay on a subtle grid background",
    "comparison": "Split-screen comparison with left/right labels and a dividing line",
  };

  return `Educational diagram for "${sceneTitle}" in ${subject}. ${narration}. Visual focus: ${visualFocus}. Style: ${strategyHints[strategy]}. Requirements: minimal clutter, clear labels, accurate representation, no decorative elements, no random people, no watermarks, focused composition.`;
}

async function generateSvgDiagram(
  _subject: string,
  sceneTitle: string,
  narration: string,
  visualFocus: string,
  _strategy: VisualStrategy,
  prompt: string,
): Promise<string | null> {
  try {
    const result = await callGroqJson([
      {
        role: "system",
        content: `You are an educational SVG diagram generator. Output ONLY a valid, self-contained SVG string (no markdown, no code fences, no explanation). The SVG must be viewBox="0 0 400 300" and use inline styles. Use clear, readable fonts (sans-serif, 14-18px). Include the title "${sceneTitle}" and key elements from: "${narration}". Focus on depicting: "${visualFocus}". Make it educationally accurate, clean, and minimal. Use rect, circle, path, text, line, polygon elements. Use #1a1a2e for dark elements, #e94560 for brand accents, #16213e for secondary. Background: #f8f9fa or transparent.`,
      },
      { role: "user", content: `Generate an SVG diagram for: ${prompt}` },
    ]);

    const raw = result.data as string | Record<string, unknown> | null;
    const svg = typeof raw === "string" ? raw.trim() : "";
    if (svg.startsWith("<svg") && svg.endsWith("</svg>")) {
      return svg;
    }
    return null;
  } catch {
    return null;
  }
}

function buildFallbackSvg(title: string, focus: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#f8f9fa" rx="12"/>
    <rect x="20" y="20" width="360" height="50" fill="#16213e" rx="8"/>
    <text x="200" y="52" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="600">${escapeXml(title.slice(0, 40))}</text>
    <circle cx="200" cy="160" r="60" fill="none" stroke="#e94560" stroke-width="3"/>
    <text x="200" y="165" text-anchor="middle" fill="#1a1a2e" font-family="sans-serif" font-size="14">${escapeXml(focus.slice(0, 30))}</text>
    <line x1="140" y1="200" x2="260" y2="200" stroke="#16213e" stroke-width="2" stroke-dasharray="6,4"/>
    <text x="200" y="240" text-anchor="middle" fill="#666" font-family="sans-serif" font-size="12">Visual explanation</text>
  </svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
