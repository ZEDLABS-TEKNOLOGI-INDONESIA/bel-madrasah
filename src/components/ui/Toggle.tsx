interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 2px",
        background: "none",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 40,
          height: 24,
          borderRadius: 99,
          background: checked ? "var(--accent)" : "var(--bg-tertiary)",
          position: "relative",
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 19 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          }}
        />
      </span>
    </button>
  );
}
