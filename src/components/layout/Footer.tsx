interface FooterProps {
  schoolName: string;
  schoolYear: string;
  poweredBy: string;
  poweredByUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  uploadUrl: string;
  githubUrl: string;
  developerName: string;
  developerUrl: string;
  developerInstagramUrl: string;
  developerLinkedinUrl: string;
}

export function Footer({
  schoolName,
  schoolYear,
  poweredBy,
  poweredByUrl,
  instagramUrl,
  youtubeUrl,
  uploadUrl,
  githubUrl,
  developerName,
  developerUrl,
  developerInstagramUrl,
  developerLinkedinUrl,
}: FooterProps) {
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
        gap: 12,
      }}
    >
      {/* Kiri: copyright */}
      <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
        © {schoolYear}{" "}
        <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>
          {schoolName}
        </span>
      </span>

      {/* Kanan: powered by + sosmed */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          Powered by{" "}
          <a
            href={poweredByUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "var(--accent)",
              fontWeight: 600,
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: 0.3,
            }}
          >
            {poweredBy}
          </a>
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Instagram */}
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            title="Instagram"
            style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>

          {/* YouTube */}
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noreferrer"
            title="YouTube"
            style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22.54 6.42A2.78 2.78 0 0 0 20.6 4.47C18.88 4 12 4 12 4s-6.88 0-8.6.47A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.53C5.12 20 12 20 12 20s6.88 0 8.6-.47a2.78 2.78 0 0 0 1.94-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
              <polygon
                points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </a>

          {/* Upload */}
          <a
            href={uploadUrl}
            target="_blank"
            rel="noreferrer"
            title="Upload Dokumentasi"
            style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </a>

          {/* GitHub */}
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            title={`Developer: ${developerName}`}
            style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>

          {/* Settings/developer info — opsional, bisa dihapus */}
          <a
            href={developerLinkedinUrl}
            target="_blank"
            rel="noreferrer"
            title={`LinkedIn: ${developerName}`}
            style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
