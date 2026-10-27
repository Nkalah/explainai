import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";

export default function ChatMathMarkdown({ content }: { content: string }) {
  return (
    <div className="text-base leading-relaxed [&_p]:m-0 [&_p+p]:mt-3 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_strong]:font-semibold [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1 [&_.katex-display]:text-[1.1em] [&_.katex-display_.katex]:whitespace-nowrap">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [rehypeKatex, { throwOnError: false, strict: false, output: "htmlAndMathml" }],
        ]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
