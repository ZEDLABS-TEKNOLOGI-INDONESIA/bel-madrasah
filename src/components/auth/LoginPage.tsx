import { AlertCircle, Music2 } from "lucide-react";
import React, { useState } from "react";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";

const shakeStyle = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  15%       { transform: translateX(-6px); }
  30%       { transform: translateX(6px); }
  45%       { transform: translateX(-4px); }
  60%       { transform: translateX(4px); }
  75%       { transform: translateX(-2px); }
  90%       { transform: translateX(2px); }
}
.shake { animation: shake 0.45s ease; }
`;

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [attempts, setAttempts] = useState(0);

  React.useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      localStorage.getItem("theme") ??
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );
  }, []);

  function triggerShake() {
    setShaking(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setShaking(true));
    });
    setTimeout(() => setShaking(false), 500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/login", { username, password });
      window.location.href = "/";
    } catch (err: any) {
      const msg = err.message ?? "Terjadi kesalahan";
      setError(msg);
      setAttempts((n) => n + 1);
      triggerShake();

      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{shakeStyle}</style>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          padding: 16,
        }}
      >
        <div
          className={shaking ? "shake" : ""}
          style={{
            width: "100%",
            maxWidth: 360,
            background: "var(--card-gloss), var(--card-bg)",
            border: `1px solid ${error ? "rgba(207,34,46,0.4)" : "var(--card-border)"}`,
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            boxShadow: error
              ? "0 0 0 3px rgba(207,34,46,0.1), var(--card-shadow)"
              : "var(--card-shadow)",
            borderRadius: "var(--radius-xl)",
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 24,
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Music2 size={24} color="#fff" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Bel Madrasah</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                Masuk untuk melanjutkan
              </div>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                autoComplete="username"
                autoFocus
                required
                style={error ? { borderColor: "var(--danger)" } : undefined}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoComplete="current-password"
                required
                style={error ? { borderColor: "var(--danger)" } : undefined}
              />
            </div>

            {/* Error banner */}
            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--danger)",
                  background: "rgba(207,34,46,0.08)",
                  border: "1px solid rgba(207,34,46,0.25)",
                  borderRadius: "var(--radius)",
                  padding: "10px 12px",
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Login gagal</div>
                  <div>{error}</div>
                  {attempts >= 3 && (
                    <div style={{ marginTop: 6, color: "var(--warning)", fontWeight: 500 }}>
                      Terlalu banyak percobaan gagal. Akun akan dikunci sementara.
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              loading={loading}
              style={{ width: "100%", marginTop: 4 }}
            >
              Masuk
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
