import { LANDING, STEPS } from "../../lib/landing";
import { Card } from "../ui/Card";
import { section } from "./landingStyle";
import { SectionHead } from "./SectionHead";

export function HowItWorks() {
  return (
    <section id="cara-kerja" style={section}>
      <SectionHead
        eyebrowText={LANDING.stepsEyebrow}
        title={LANDING.stepsTitle}
        lead={LANDING.stepsLead}
      />
      <ol
        style={{
          listStyle: "none",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.title} style={{ display: "flex" }}>
              <Card
                style={{
                  width: "100%",
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--radius)",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span
                  className="tabular"
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}
                >
                  {s.time}
                </span>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{s.desc}</p>
              </Card>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
