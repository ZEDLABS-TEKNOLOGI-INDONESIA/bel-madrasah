import React from "react";

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  formatLabel?: (val: number) => string;
}

export function Slider({
  value,
  min = 0,
  max = 2,
  step = 0.01,
  onChange,
  disabled,
  formatLabel,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {formatLabel && (
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
          {formatLabel(value)}
        </span>
      )}
      <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 99,
            background: "var(--bg-tertiary)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "var(--accent)",
              borderRadius: 99,
              transition: "width 0.1s",
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            width: "100%",
            opacity: 0,
            height: 20,
            cursor: disabled ? "not-allowed" : "pointer",
            margin: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `calc(${pct}% - 8px)`,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "var(--accent)",
            border: "2px solid var(--bg)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            transition: "left 0.1s",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
