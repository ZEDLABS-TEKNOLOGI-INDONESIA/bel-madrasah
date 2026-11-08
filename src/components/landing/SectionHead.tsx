import { eyebrow } from "./landingStyle";

interface SectionHeadProps {
  eyebrowText: string;
  title: string;
  lead?: string;
}

export function SectionHead({ eyebrowText, title, lead }: SectionHeadProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
      <p style={eyebrow}>{eyebrowText}</p>
      <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--text)" }}>{title}</h2>
      {lead && <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 640 }}>{lead}</p>}
    </div>
  );
}
