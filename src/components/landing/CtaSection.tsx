import { FOOTER } from "../../lib/footer";
import { LANDING } from "../../lib/landing";
import { Card } from "../ui/Card";
import { primaryLink, section } from "./landingStyle";

export function CtaSection() {
  return (
    <section style={{ ...section, paddingTop: 0 }}>
      <Card
        style={{
          padding: 32,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--text)" }}>{LANDING.ctaTitle}</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{LANDING.ctaLead}</p>
        <a href="/login" className="btn" style={{ ...primaryLink, marginTop: 8 }}>
          {LANDING.primaryCta}
        </a>
        {FOOTER.schoolName && (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {LANDING.nowAt} {FOOTER.schoolName}
          </p>
        )}
      </Card>
    </section>
  );
}
