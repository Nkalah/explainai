export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 21 L14 11 L19 21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 17 L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="22.5" cy="12" r="1.6" fill="oklch(0.54 0.19 268)" />
    </svg>
  );
}
