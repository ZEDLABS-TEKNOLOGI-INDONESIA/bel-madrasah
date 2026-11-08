import { useIsMobile } from "../../hooks/useMediaQuery";
import { FOOTER } from "../../lib/footer";
import { LANDING } from "../../lib/landing";
import { BAR_H } from "../../lib/layout";
import { BellDemo } from "./BellDemo";
import { container, eyebrow, primaryLink, secondaryLink } from "./landingStyle";

export function Hero() {
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ ...container, padding: isMobile ? "40px 16px" : "64px 16px" }}>
        <div className="grid grid-cols-12 gap-4" style={{ alignItems: "center" }}>
          <div
            className="col-span-12 lg:col-span-7"
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
            <p style={eyebrow}>{LANDING.eyebrow}</p>
            <h1
              style={{
                fontSize: isMobile ? 30 : 40,
                fontWeight: 600,
                lineHeight: 1.15,
                color: "var(--text)",
                maxWidth: 580,
              }}
            >
              {LANDING.headline}
            </h1>
            <p style={{ fontSize: 15, color: "var(--text-muted)", maxWidth: 520 }}>
              {LANDING.lead}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <a href="/login" className="btn" style={primaryLink}>
                {LANDING.primaryCta}
              </a>
              <a href="#coba" className="btn" style={secondaryLink}>
                {LANDING.secondaryCta}
              </a>
            </div>
            {FOOTER.poweredBy && (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {LANDING.madeBy} {FOOTER.poweredBy}
              </p>
            )}
          </div>
          <div
            id="coba"
            className="col-span-12 lg:col-span-5"
            style={{ scrollMarginTop: BAR_H + 16 }}
          >
            <BellDemo />
          </div>
        </div>
      </div>
    </div>
  );
}
