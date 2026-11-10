import { BellRing } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DEMO, PREVIEW, type DemoRow } from "../../lib/landing";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { Toggle } from "../ui/Toggle";

export function BellDemo() {
  const [libur, setLibur] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [rows, setRows] = useState<DemoRow[]>([]);
  const [status, setStatus] = useState<string>(DEMO.idle);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function push(row: DemoRow) {
    setRows((prev) => [row, ...prev].slice(0, DEMO.maxRows));
  }

  function ring() {
    if (ringing) return;
    const base = PREVIEW[cursor % PREVIEW.length];
    setCursor((c) => c + 1);

    if (libur) {
      push({ ...base, result: "skipped" });
      setStatus(DEMO.skipped);
      return;
    }

    push({ ...base, result: "played" });
    setRinging(true);
    setStatus(`${DEMO.ringing} ${base.waktu} ${base.audio}`);
    timer.current = setTimeout(() => {
      setRinging(false);
      setStatus(DEMO.done);
    }, DEMO.ringMs);
  }

  return (
    <Card
      title={DEMO.title}
      action={
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)" }}>{DEMO.liburLabel}</span>
          <Toggle checked={libur} onChange={setLibur} label={DEMO.liburLabel} />
        </label>
      }
      bodyStyle={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: 20,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-secondary)",
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: "var(--radius)",
            background: ringing ? "var(--accent-soft)" : "var(--bg-tertiary)",
            color: ringing ? "var(--accent)" : "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BellRing size={20} aria-hidden="true" />
        </span>
        {ringing ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 24 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="wave-bar" style={{ height: `${8 + i * 3}px` }} />
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{DEMO.waiting}</span>
        )}
      </div>

      <Button variant="primary" onClick={ring} disabled={ringing}>
        {DEMO.ring}
      </Button>

      <p
        role="status"
        aria-live="polite"
        style={{ fontSize: 12, color: "var(--text-muted)", minHeight: 18 }}
      >
        {status}
      </p>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        {rows.length === 0 ? (
          <EmptyState text={DEMO.empty} padding={20} />
        ) : (
          rows.map((row, i) => (
            <ListRow key={`${row.waktu}-${i}`} last={i === rows.length - 1} style={{ gap: 16 }}>
              <span
                className="tabular"
                style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", width: 48 }}
              >
                {row.waktu}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text)" }}>
                {row.audio}
              </span>
              <Badge variant={row.result === "played" ? "accent" : "warning"}>
                {row.result === "played" ? DEMO.played : DEMO.skippedBadge}
              </Badge>
            </ListRow>
          ))
        )}
      </div>
    </Card>
  );
}
