import { Activity, Download, RefreshCw, Shield, Upload } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useServiceStatus, useUpdateVolume, useVolume } from "../../hooks/useConfig";
import { api } from "../../lib/api";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Slider } from "../ui/Slider";

function SectionHeader({ title }: { title: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {title}
    </span>
  );
}

function VolumeSection() {
  const { data } = useVolume();
  const update = useUpdateVolume();
  const [local, setLocal] = useState<number>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data?.volume != null) setLocal(data.volume);
  }, [data?.volume]);

  function handleChange(val: number) {
    setLocal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await update.mutateAsync(val);
        toast.success("Volume disimpan");
      } catch (e: any) {
        toast.error(e.message);
      }
    }, 300);
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHeader title="Volume Output" />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Level volume</span>
        <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(local * 100)}%
        </span>
      </div>
      <Slider
        value={local}
        min={0}
        max={2}
        step={0.01}
        onChange={handleChange}
        disabled={update.isPending}
        formatLabel={(v) => `${Math.round(v * 100)}%`}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <span>0%</span>
        <span style={{ color: local > 1 ? "var(--warning)" : "var(--text-muted)" }}>
          {local > 1 ? "Amplifikasi aktif — bisa distorsi" : "100% = volume normal"}
        </span>
        <span>200%</span>
      </div>
    </Card>
  );
}

function PasswordSection() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password baru minimal 8 karakter");
      return;
    }
    if (newPassword !== confirm) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      toast.success("Password berhasil diubah");
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Shield size={14} color="var(--text-muted)" />
        <SectionHeader title="Ganti Password" />
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Password Lama
          </label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Password Baru
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Minimal 8 karakter</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Konfirmasi Password Baru
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          {confirm && newPassword !== confirm && (
            <span style={{ fontSize: 11, color: "var(--danger)" }}>Password tidak cocok</span>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="primary" loading={loading}>
            Simpan Password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function BackupSection() {
  const restoreRef = useRef<HTMLInputElement>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  function handleBackup() {
    window.location.href = "/api/backup";
  }

  async function handleRestore(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith(".json")) {
      toast.error("File harus berformat JSON");
      return;
    }
    if (!confirm(`Restore jadwal dari ${file.name}? Data jadwal saat ini akan ditimpa.`)) return;

    setRestoreLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      await api.upload("/api/restore", form);
      toast.success("Jadwal berhasil direstore");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRestoreLoading(false);
      if (restoreRef.current) restoreRef.current.value = "";
    }
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHeader title="Backup & Restore" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderRadius: "var(--radius)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Download Backup</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Ekspor semua jadwal ke file JSON
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={13} />}
            onClick={handleBackup}
          >
            Download
          </Button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderRadius: "var(--radius)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Restore Backup</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Import jadwal dari file JSON backup
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={13} />}
            loading={restoreLoading}
            onClick={() => restoreRef.current?.click()}
          >
            Restore
          </Button>
        </div>
        <input
          ref={restoreRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={(e) => handleRestore(e.target.files)}
        />
      </div>
    </Card>
  );
}

function InfoSection() {
  const { data, isLoading, refetch } = useServiceStatus();
  const [healthStatus, setHealthStatus] = useState<"ok" | "error" | "checking" | null>(null);

  async function checkHealth() {
    setHealthStatus("checking");
    try {
      const res = await fetch("/healthz", { credentials: "include" });
      setHealthStatus(res.ok ? "ok" : "error");
    } catch {
      setHealthStatus("error");
    }
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Activity size={14} color="var(--text-muted)" />
        <SectionHeader title="Info & Status" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          {
            label: "Scheduler",
            value: isLoading ? "-" : data?.running ? "Berjalan" : "Dihentikan",
            variant: data?.running ? "success" : "danger",
          },
          {
            label: "Mode Aktif",
            value: data?.active_mode ?? "-",
            variant: "accent",
          },
          {
            label: "Status Hari",
            value: data?.is_libur ? "Libur" : "Aktif",
            variant: data?.is_libur ? "warning" : "default",
          },
        ].map(({ label, value, variant }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>{label}</span>
            <Badge variant={variant as any}>{value}</Badge>
          </div>
        ))}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>Health Check</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {healthStatus && (
              <Badge
                variant={
                  healthStatus === "ok"
                    ? "success"
                    : healthStatus === "error"
                      ? "danger"
                      : "default"
                }
                dot
              >
                {healthStatus === "ok" ? "OK" : healthStatus === "error" ? "Error" : "Checking..."}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={12} />}
              onClick={checkHealth}
              loading={healthStatus === "checking"}
            >
              Cek
            </Button>
          </div>
        </div>
      </div>

      <div
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <span>Bel Madrasah</span>
        <span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--text-muted)" }}
          >
            GitHub
          </a>
        </span>
      </div>
    </Card>
  );
}

export function PengaturanPage() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div
        className="col-span-12 md:col-span-6"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <VolumeSection />
        <PasswordSection />
      </div>
      <div
        className="col-span-12 md:col-span-6"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <BackupSection />
        <InfoSection />
      </div>
    </div>
  );
}
