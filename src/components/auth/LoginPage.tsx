import { Check, Eye, EyeOff, User } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { api } from "../../lib/api";
import { initTheme } from "../../lib/theme";

if (typeof document !== "undefined") initTheme();

const FEATURES = [
  {
    title: "Berbunyi otomatis sesuai jadwal",
    desc: "Scheduler berjalan di server dan tidak bergantung pada browser.",
  },
  {
    title: "Mode jadwal yang fleksibel",
    desc: "Reguler, Ramadhan, PTS, PAS, dan pesantren siap dipakai.",
  },
  {
    title: "Libur dan nada mudah diatur",
    desc: "Impor libur nasional dan unggah audio dalam beberapa klik.",
  },
];

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text)",
};

function Required() {
  return <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>;
}

export function LoginPage() {
  const narrow = useIsMobile(900);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/login", { username: username.trim(), password });
      window.location.href = "/";
    } catch (err: any) {
      setError(err?.message ?? "Gagal masuk");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        gridTemplateColumns: narrow ? "1fr" : "544px 1fr",
        background: "var(--bg)",
        color: "var(--text)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          padding: 24,
          overflowY: "auto",
          overflowX: "hidden",
          background: narrow ? "var(--bg)" : "var(--panel)",
          borderRight: narrow ? "none" : "1px solid var(--border)",
          WebkitOverflowScrolling: "touch" as any,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 416,
            margin: "auto",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "24px 20px 20px",
              borderBottom: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/icon.svg" alt="Bel Madrasah" width={28} height={28} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Bel Madrasah</span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Masuk ke panel</h1>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Gunakan username dan password akun administrator.
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 18, padding: 28 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label htmlFor="username" style={labelStyle}>
                Username
                <Required />
              </label>
              <div className="input-group">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  style={{ fontSize: 16, height: 36 }}
                />
                <span className="addon">
                  <User size={16} />
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label htmlFor="password" style={labelStyle}>
                Password
                <Required />
              </label>
              <div className="input-group">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  style={{ fontSize: 16, height: 36 }}
                />
                <button
                  type="button"
                  className="addon"
                  onClick={() => setShow((v) => !v)}
                  title={show ? "Sembunyikan password" : "Tampilkan password"}
                  style={{ cursor: "pointer" }}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--danger)",
                  background: "var(--danger-soft)",
                  border: "1px solid var(--danger-border)",
                  borderRadius: "var(--radius)",
                  padding: "8px 12px",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn"
              disabled={loading}
              style={{
                height: 36,
                borderRadius: "var(--radius)",
                border: "1px solid var(--accent)",
                background: "var(--accent-soft)",
                color: "var(--accent)",
                fontFamily: "var(--font)",
                fontSize: 13,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>

      {!narrow && (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 96px",
            backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          <img
            src="/icon.svg"
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              right: -160,
              top: "50%",
              transform: "translateY(-50%)",
              width: 640,
              height: 640,
              opacity: 0.05,
              pointerEvents: "none",
            }}
          />

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: -48,
              textAlign: "center",
              fontSize: 220,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -4,
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              color: "var(--text)",
              opacity: 0.05,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            ZEDLABS
          </div>

          <div style={{ position: "relative", maxWidth: 560 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "var(--accent)",
              }}
            >
              <span style={{ width: 20, height: 1, background: "var(--accent)" }} />
              Bel Madrasah
            </div>
            <h2
              style={{
                fontSize: 36,
                fontWeight: 600,
                lineHeight: 1.2,
                marginTop: 16,
                color: "var(--text)",
              }}
            >
              Bel madrasah Anda, tepat waktu setiap hari.
            </h2>
            <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 16 }}>
              Jadwal, nada, dan hari libur dikelola dari satu tempat.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 32 }}>
              {FEATURES.map((f) => (
                <div key={f.title} style={{ display: "flex", gap: 14 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      flexShrink: 0,
                      borderRadius: "50%",
                      border: "1px solid var(--border)",
                      background: "var(--panel)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--accent)",
                    }}
                  >
                    <Check size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{f.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {f.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
