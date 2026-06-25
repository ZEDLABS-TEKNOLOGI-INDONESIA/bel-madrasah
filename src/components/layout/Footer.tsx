interface FooterProps {
  schoolName: string;
  schoolYear: string;
  poweredBy: string;
  poweredByUrl: string;
}

export function Footer({ schoolName, schoolYear, poweredBy, poweredByUrl }: FooterProps) {
  return (
    <footer
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 44,
        borderTop: "1px solid var(--border)",
        background: "var(--card-gloss), var(--card-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
        © {schoolYear}{" "}
        <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {schoolName}
        </span>
      </span>

      {poweredBy && (
        <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          Powered by{" "}
          <a
            href={poweredByUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "var(--accent)",
              fontWeight: 700,
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {poweredBy}
          </a>
        </span>
      )}
    </footer>
  );
}
