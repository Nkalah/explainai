import { Hero, Features, HowItWorks, Testimonials, Pricing, FAQ, FinalCTA } from "./Sections";
import { SearchBar } from "./SearchBar";

export function LandingPage() {
  return (
    <>
      <Hero />
      <SearchBar />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
    </>
  );
}
