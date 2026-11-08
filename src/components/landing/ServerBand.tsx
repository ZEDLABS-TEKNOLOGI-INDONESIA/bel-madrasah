import { LANDING, SERVER_LAYERS } from "../../lib/landing";
import { band, container, eyebrow } from "./landingStyle";

export function ServerBand() {
  return (
    <div style={band}>
      <div style={{ ...container, padding: "56px 16px" }}>
        <div className="grid grid-cols-12 gap-4">
          <div
            className="col-span-12 md:col-span-5"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <p style={eyebrow}>{LANDING.serverEyebrow}</p>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--text)" }}>
              {LANDING.serverTitle}
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{LANDING.serverLead}</p>
          </div>
          <ul
            className="col-span-12 md:col-span-7"
            style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 16 }}
          >
            {SERVER_LAYERS.map((l) => (
              <li key={l.title} style={{ borderLeft: "2px solid var(--accent)", paddingLeft: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{l.title}</h3>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{l.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
