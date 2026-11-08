import { BENEFITS, LANDING } from "../../lib/landing";
import { Card } from "../ui/Card";
import { section } from "./landingStyle";
import { SectionHead } from "./SectionHead";

export function Benefits() {
  return (
    <section id="keunggulan" style={section}>
      <SectionHead eyebrowText={LANDING.benefitsEyebrow} title={LANDING.benefitsTitle} />
      <div className="grid grid-cols-12 gap-4">
        {BENEFITS.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.title} className="col-span-12 md:col-span-6 lg:col-span-3">
              <Card
                style={{
                  height: "100%",
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
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{b.title}</h3>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{b.desc}</p>
              </Card>
            </div>
          );
        })}
      </div>
    </section>
  );
}
