/**
 * Whiteboard — signature hero visual. Animated SVG that mimics a teacher
 * writing on paper: equation appears stroke by stroke, ink is circled, the
 * final answer is boxed. Pure SVG + CSS; no runtime deps.
 *
 * Design notes:
 * - viewBox is 1000x620, drawn with a consistent ~60px inner margin on every
 *   side so nothing ever sits at the literal edge of the canvas — this is
 *   what actually prevents "cut off" text, independent of how the browser
 *   scales the SVG at different screen sizes.
 * - Chrome/caption bars use flex-shrink-0 + truncate so long strings degrade
 *   gracefully on narrow viewports instead of overlapping or forcing scroll.
 */
export function Whiteboard() {
  return (
    <div className="relative flex aspect-[16/11] w-full flex-col overflow-hidden rounded-2xl border bg-card shadow-[0_1px_0_rgba(0,0,0,0.03),0_20px_60px_-30px_rgba(15,15,30,0.25)]">
      {/* paper grid */}
      <div className="pointer-events-none absolute inset-0 hairline-grid opacity-40" aria-hidden />

      {/* top chrome */}
      <div className="relative flex flex-shrink-0 items-center gap-2 border-b bg-card/80 px-4 py-3 backdrop-blur-sm">
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-hairline" />
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-hairline" />
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-hairline" />
        <div className="ml-3 flex min-w-0 items-center gap-2 truncate font-mono text-[11px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand animate-pulse" />
          <span className="truncate">Lesson 001 · Linear equations</span>
        </div>
        <div className="ml-auto flex-shrink-0 font-mono text-[11px] text-muted-foreground">
          00:24 / 01:12
        </div>
      </div>

      {/* drawing surface — flex-1 so it always fills exactly the leftover
          space between chrome and caption, at any screen size */}
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox="0 0 1000 620"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Q label */}
          <text
            x="60"
            y="100"
            fontFamily="var(--font-mono)"
            fontSize="16"
            fill="oklch(0.48 0.012 260)"
            stroke="none"
          >
            Q. Solve for x
          </text>

          {/* Equation: 3x + 7 = 22 (drawn stroke by stroke) */}
          <g className="text-foreground">
            <path
              className="stroke-draw"
              d="M75 195 C87 171, 134 171, 134 206 C134 235, 87 241, 111 224 C134 212, 146 247, 111 253"
              style={{ animationDelay: "0.1s" }}
            />
            <path
              className="stroke-draw"
              d="M172 189 L214 260 M214 189 L172 260"
              style={{ animationDelay: "0.35s" }}
            />
            <path
              className="stroke-draw"
              d="M252 224 L316 224"
              style={{ animationDelay: "0.6s" }}
            />
            <path
              className="stroke-draw"
              d="M354 195 C360 171, 402 171, 402 212 C402 235, 360 253, 348 253 L414 253"
              style={{ animationDelay: "0.8s" }}
            />
            <path
              className="stroke-draw"
              d="M457 206 L457 260 M434 206 L481 206"
              style={{ animationDelay: "1.05s" }}
            />
            <path
              className="stroke-draw"
              d="M515 212 L590 212 M515 241 L590 241"
              style={{ animationDelay: "1.3s" }}
            />
            <path
              className="stroke-draw"
              d="M628 195 C634 171, 688 171, 688 212 C688 235, 628 265, 628 265 L700 265"
              style={{ animationDelay: "1.55s" }}
            />
            <path
              className="stroke-draw"
              d="M736 195 C742 171, 792 171, 792 212 C792 235, 736 265, 736 265 L808 265"
              style={{ animationDelay: "1.75s" }}
            />
          </g>

          {/* teacher circles the +7 */}
          <path
            className="stroke-draw text-brand"
            stroke="currentColor"
            strokeWidth={3}
            d="M242 189 C212 183, 205 268, 268 268 C332 262, 344 183, 314 178 C290 176, 246 178, 242 187"
            style={{ animationDelay: "2s" }}
          />

          {/* subtract 7 note */}
          <text
            x="610"
            y="330"
            fontFamily="var(--font-mono)"
            fontSize="16"
            fill="oklch(0.54 0.19 268)"
            stroke="none"
            className="animate-[fade-in_0.4s_ease-out_2.4s_both]"
          >
            −7 both sides
          </text>

          {/* Line 2: 3x = 15 */}
          <g className="text-foreground">
            <path
              className="stroke-draw"
              d="M75 405 C87 381, 134 381, 134 416 C134 445, 87 452, 111 435 C134 423, 146 458, 111 464"
              style={{ animationDelay: "2.7s" }}
            />
            <path
              className="stroke-draw"
              d="M172 399 L214 470 M214 399 L172 470"
              style={{ animationDelay: "2.9s" }}
            />
            <path
              className="stroke-draw"
              d="M268 424 L344 424 M268 453 L344 453"
              style={{ animationDelay: "3.1s" }}
            />
            <path
              className="stroke-draw"
              d="M390 405 L390 470 M366 405 L414 405"
              style={{ animationDelay: "3.3s" }}
            />
            <path
              className="stroke-draw"
              d="M453 405 C460 381, 508 381, 508 424 C508 448, 453 476, 453 476 L522 476"
              style={{ animationDelay: "3.5s" }}
            />
          </g>

          {/* divide by 3 note */}
          <text
            x="610"
            y="440"
            fontFamily="var(--font-mono)"
            fontSize="16"
            fill="oklch(0.54 0.19 268)"
            stroke="none"
            className="animate-[fade-in_0.4s_ease-out_3.8s_both]"
          >
            ÷ 3
          </text>

          {/* boxed answer x = 5 */}
          <g className="animate-[fade-in_0.5s_ease-out_4.4s_both]">
            <rect
              x="660"
              y="380"
              width="230"
              height="104"
              rx="8"
              stroke="oklch(0.54 0.19 268)"
              strokeWidth={2.6}
              className="stroke-draw"
              style={{ animationDelay: "4.4s" }}
            />
            <text
              x="722"
              y="450"
              fontFamily="var(--font-display)"
              fontSize="52"
              fill="currentColor"
              stroke="none"
            >
              x = 5
            </text>
          </g>
        </svg>
      </div>

      {/* caption */}
      <div className="pointer-events-none relative flex flex-shrink-0 items-center justify-between gap-3 border-t bg-background/80 px-4 py-2.5 backdrop-blur">
        <div className="min-w-0 truncate text-xs text-muted-foreground">
          <span className="text-foreground">Narration:</span>{" "}
          "…subtract seven from both sides to isolate the variable."
        </div>
        <div className="hidden flex-shrink-0 items-center gap-1.5 sm:flex">
          {[...Array(24)].map((_, i) => (
            <span
              key={i}
              className="block w-[2px] rounded-full bg-brand/70"
              style={{
  height: `${(6 + Math.abs(Math.sin(i * 0.9)) * 12).toFixed(2)}px`,
  opacity: Number((0.35 + Math.abs(Math.sin(i * 0.9)) * 0.65).toFixed(2)),
}}
            />
          ))}
        </div>
      </div>
    </div>
  );
}