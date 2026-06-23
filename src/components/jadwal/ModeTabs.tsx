import React from "react";

const MODE_LABELS: Record<string, string> = {
  reguler: "Reguler",
  ramadhan: "Ramadhan",
  pts: "PTS",
  pas: "PAS",
  pesantren: "Pesantren",
  lainnya: "Lainnya",
};

interface ModeTabsProps {
  modes: string[];
  active: string;
  activeMode: string;
  onChange: (mode: string) => void;
}

export function ModeTabs({ modes, active, activeMode, onChange }: ModeTabsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 4,
        scrollbarWidth: "none",
      }}
    >
      {modes.map((m) => {
        const isActive = m === active;
        const isRunning = m === activeMode;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 99,
              border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: isActive ? "rgba(9,105,218,0.1)" : "var(--bg-secondary)",
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              fontFamily: "var(--font)",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            {isRunning && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  flexShrink: 0,
                }}
              />
            )}
            {MODE_LABELS[m] ?? m}
          </button>
        );
      })}
    </div>
  );
}
