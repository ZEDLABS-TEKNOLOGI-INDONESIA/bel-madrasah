interface SliderProps {
  value: number;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  formatLabel?: (val: number) => string;
  valueText?: string;
  origin?: number;
}

export function Slider({
  value,
  label,
  min = 0,
  max = 2,
  step = 0.01,
  onChange,
  disabled,
  formatLabel,
  valueText,
  origin = min,
}: SliderProps) {
  const toPct = (v: number) => ((v - min) / (max - min)) * 100;
  const pct = toPct(value);
  const base = toPct(origin);
  const fillLeft = Math.min(pct, base);
  const fillWidth = Math.abs(pct - base);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {formatLabel && (
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
          {formatLabel(value)}
        </span>
      )}
      <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
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
              position: "absolute",
              left: `${fillLeft}%`,
              width: `${fillWidth}%`,
              height: "100%",
              background: "var(--accent)",
              borderRadius: 99,
              transition: "left 0.1s, width 0.1s",
            }}
          />
        </div>
        <input
          type="range"
          className="slider-input"
          aria-label={label}
          aria-valuetext={valueText}
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
            height: 28,
            padding: 0,
            cursor: disabled ? "not-allowed" : "pointer",
            margin: 0,
          }}
        />
        <div
          className="slider-thumb"
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
