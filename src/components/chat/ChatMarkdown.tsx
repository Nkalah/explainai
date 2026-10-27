import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { lazy, Suspense } from "react";

const MathMarkdown = lazy(() => import("./ChatMathMarkdown"));

function normalizeMath(text: string): string {
  const withMathDelimiters = text
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => `$$\n${formula}\n$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula: string) => `$${formula}$`)
    .replace(/^\$\$[ \t]*\r?\n(?:[ \t]*\r?\n)?\$\$[ \t]*$/gm, "")
    .replace(
      /\$\$([\s\S]*?)\$\$/g,
      (_match, formula: string) => `$$${formula.replace(/(?<!\$)\$(?!\$)/g, "")}$$`,
    )
    .replace(
      /^\[([^\r\n]*\\(?:frac|text|varepsilon)[^\r\n]*)\]$/gm,
      (_match, formula: string) => `$$\n${formula}\n$$`,
    )
    .replace(/```(?:latex|math)?[ \t]*\r?\n([\s\S]*?)\r?\n```/gi, (block, formula: string) =>
      isLatexFormula(formula.trim()) ? `$$\n${formula.trim()}\n$$` : block,
    );

  const withMhchem = withMathDelimiters
    .split("\n")
    .map((line) =>
      line.includes("$")
        ? line
        : line.replace(
            /\\(ce|pu)\{([^{}\r\n]*)\}/g,
            (_match, command: string, formula: string) => `$\\${command}{${formula}}$`,
          ),
    )
    .join("\n");

  let insideDisplayMath = false;
  return withMhchem
    .split("\n")
    .map((line) => {
      const formula = line.trim();
      if (formula === "$$") {
        insideDisplayMath = !insideDisplayMath;
        return line;
      }
      if (insideDisplayMath || formula.includes("$") || !isLatexFormula(formula)) return line;
      return `$$\n${formula}\n$$`;
    })
    .join("\n");
}

function isLatexFormula(text: string): boolean {
  const startsWithEquation =
    /^\\[A-Za-z]+/.test(text) ||
    /^[A-Za-z](?:[_^](?:\{[^}]+\}|[A-Za-z0-9]))?\s*(?:=|<|>)/.test(text);
  return (
    startsWithEquation &&
    /\\(?:ce|pu|frac|dfrac|tfrac|sqrt|text|varepsilon|epsilon|lambda|pi|theta|boxed|begin|end|cdot|times|le|ge|neq|alpha|beta|omega)|[_^](?:\{[^}]+\}|[A-Za-z0-9])/.test(
      text,
    ) &&
    /^[\w\s\\{}\x5B\x5D^=+*\x2F().,;:&|<>-]+$/u.test(text)
  );
}

export default function ChatMarkdown({ content }: { content: string }) {
  const normalizedContent = normalizeMath(content);
  if (normalizedContent.includes("$")) {
    return (
      <Suspense fallback={<div className="whitespace-pre-wrap">{content}</div>}>
        <MathMarkdown content={normalizedContent} />
      </Suspense>
    );
  }

  return (
    <div className="text-base leading-relaxed [&_p]:m-0 [&_p+p]:mt-3 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_strong]:font-semibold [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1 [&_.katex-display]:text-[1.1em] [&_.katex-display_.katex]:whitespace-nowrap">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizedContent}</ReactMarkdown>
    </div>
  );
}
