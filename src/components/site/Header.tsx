import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-transparent bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <span className="text-[15px] font-medium tracking-tight">ExplainAI</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="#"
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
          >
            Sign in
          </a>
          <a
            href="#try"
            className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-transform hover:scale-[1.02]"
          >
            Try free
          </a>
        </div>
      </div>
    </header>
  );
}
