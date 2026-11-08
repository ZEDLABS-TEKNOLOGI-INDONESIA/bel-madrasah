import { FAQ, LANDING } from "../../lib/landing";
import { Card } from "../ui/Card";
import { section } from "./landingStyle";
import { SectionHead } from "./SectionHead";

export function Faq() {
  return (
    <section id="tanya" style={{ ...section, maxWidth: 800 }}>
      <SectionHead eyebrowText={LANDING.faqEyebrow} title={LANDING.faqTitle} />
      <Card bodyStyle={{ padding: 0 }} style={{ padding: 0, overflow: "hidden" }}>
        {FAQ.map((item, i) => (
          <details
            key={item.q}
            style={{
              padding: "14px 16px",
              borderBottom: i === FAQ.length - 1 ? "none" : "1px solid var(--border)",
            }}
          >
            <summary
              style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text)" }}
            >
              {item.q}
            </summary>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>{item.a}</p>
          </details>
        ))}
      </Card>
    </section>
  );
}
