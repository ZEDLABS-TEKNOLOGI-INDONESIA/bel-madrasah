import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}
      >
        {label}
      </label>
      {children}
      {error ? (
        <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</span>
      ) : null}
    </div>
  );
}
