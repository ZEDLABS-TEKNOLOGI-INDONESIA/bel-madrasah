import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { HARI, MODE_VARIANT, modeLabel } from "../../lib/constants";
import { LANDING, PREVIEW, ROLES, type Role, type RoleKey } from "../../lib/landing";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { ListRow } from "../ui/ListRow";
import { SettingRow } from "../ui/SettingRow";
import { section } from "./landingStyle";
import { SectionHead } from "./SectionHead";

const LOG_ROWS = PREVIEW.slice(0, 3);
const WEEK = [...HARI.slice(1), HARI[0]];
const OFF_DAYS = ["Sabtu", "Minggu"];
const MODE_SAMPLE = "reguler";

function LogFigure() {
  return (
    <Card title="Riwayat" action={<Badge>{LOG_ROWS.length}</Badge>} bodyStyle={{ padding: 0 }}>
      {LOG_ROWS.map((row, i) => (
        <ListRow key={row.waktu} last={i === LOG_ROWS.length - 1} style={{ gap: 16 }}>
          <span className="tabular" style={{ fontSize: 12, color: "var(--text-muted)", width: 48 }}>
            {row.waktu}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text)" }}>
            {row.audio}
          </span>
          <Badge variant={MODE_VARIANT[MODE_SAMPLE]}>{modeLabel(MODE_SAMPLE)}</Badge>
        </ListRow>
      ))}
    </Card>
  );
}

function JadwalFigure() {
  return (
    <Card title="Hari aktif" bodyStyle={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {WEEK.map((day) => {
        const off = OFF_DAYS.includes(day);
        return (
          <span
            key={day}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 99,
              border: "1px solid var(--border)",
              color: off ? "var(--text-muted)" : "var(--text)",
              fontSize: 12,
              textDecoration: off ? "line-through" : "none",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: off ? "var(--danger)" : "var(--success)",
              }}
            />
            {day}
          </span>
        );
      })}
    </Card>
  );
}

function StatusFigure() {
  return (
    <Card title="Info dan status" bodyStyle={{ padding: 0 }}>
      <SettingRow title="Scheduler">
        <Badge variant="success" dot>
          Berjalan
        </Badge>
      </SettingRow>
      <SettingRow title="Mode aktif">
        <Badge variant="accent" dot>
          {modeLabel(MODE_SAMPLE)}
        </Badge>
      </SettingRow>
      <SettingRow title="Volume" last>
        <Badge>100%</Badge>
      </SettingRow>
    </Card>
  );
}

const FIGURES: Record<RoleKey, ReactNode> = {
  log: <LogFigure />,
  jadwal: <JadwalFigure />,
  status: <StatusFigure />,
};

function RoleText({ role }: { role: Role }) {
  return (
    <div
      className="col-span-12 md:col-span-6"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <h3 style={{ fontSize: 20, fontWeight: 600, color: "var(--text)" }}>{role.title}</h3>
      <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{role.lead}</p>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {role.points.map((p) => (
          <li key={p} style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--text)" }}>
            <Check
              size={14}
              aria-hidden="true"
              style={{ flexShrink: 0, marginTop: 3, color: "var(--accent)" }}
            />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RoleSection() {
  const isMobile = useIsMobile();

  return (
    <section id="fitur" style={section}>
      <SectionHead eyebrowText={LANDING.rolesEyebrow} title={LANDING.rolesTitle} />
      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        {ROLES.map((role, i) => {
          const flipped = i % 2 === 1 && !isMobile;
          const text = <RoleText role={role} />;
          const figure = (
            <div className="col-span-12 md:col-span-6" style={{ minWidth: 0 }}>
              {FIGURES[role.key]}
            </div>
          );
          return (
            <article
              key={role.key}
              className="grid grid-cols-12 gap-4"
              style={{ alignItems: "center" }}
            >
              {flipped ? (
                <>
                  {figure}
                  {text}
                </>
              ) : (
                <>
                  {text}
                  {figure}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
