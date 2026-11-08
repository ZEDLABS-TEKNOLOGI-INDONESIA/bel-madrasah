import { FOOTER } from "../../lib/footer";
import { initTheme } from "../../lib/theme";
import { Footer } from "../layout/Footer";
import { Benefits } from "./Benefits";
import { CtaSection } from "./CtaSection";
import { Faq } from "./Faq";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { LandingNav } from "./LandingNav";
import { RoleSection } from "./RoleSection";
import { ServerBand } from "./ServerBand";

if (typeof document !== "undefined") initTheme();

export function LandingPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--text)" }}>
      <LandingNav />
      <main>
        <Hero />
        <HowItWorks />
        <ServerBand />
        <Benefits />
        <RoleSection />
        <Faq />
        <CtaSection />
      </main>
      <Footer
        schoolName={FOOTER.schoolName}
        schoolYear={FOOTER.schoolYear}
        poweredBy={FOOTER.poweredBy}
        poweredByUrl={FOOTER.poweredByUrl}
      />
    </div>
  );
}
