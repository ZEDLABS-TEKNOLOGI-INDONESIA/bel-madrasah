import { Download, RefreshCw, Upload } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useServiceStatus, useUpdateVolume, useVolume } from "../../hooks/useConfig";
import { api } from "../../lib/api";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { PageHeader } from "../ui/PageHeader";
import { Slider } from "../ui/Slider";

function Row(props: { title: string; desc?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 16px",
        borderBottom: props.last ? "none" : "1px solid var(--border)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{props.title}</div>
        {props.desc && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{props.desc}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{props.children}</div>
    </div>
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
    <Card
      title="Volume output"
      action={
        <span className="tabular" style={{ fontSize: 16, fontWeight: 600 }}>
          {Math.round(local * 100)}%
        </span>
      }
      bodyStyle={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <Slider
        value={local}
        min={0}
        max={2}
        step={0.01}
        onChange={handleChange}
        disabled={update.isPending}
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
          {local > 1 ? "Amplifikasi aktif, bisa distorsi" : "100% = volume normal"}
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
    <Card title="Ganti password">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Password lama
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
            Password baru
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
            Konfirmasi password baru
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
            Simpan password
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
    <Card title="Backup dan restore" bodyStyle={{ padding: 0 }}>
      <Row title="Download backup" desc="Ekspor semua jadwal ke file JSON">
        <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={handleBackup}>
          Download
        </Button>
      </Row>
      <Row title="Restore backup" desc="Import jadwal dari file JSON backup" last>
        <Button
          variant="secondary"
          size="sm"
          icon={<Upload size={13} />}
          loading={restoreLoading}
          onClick={() => restoreRef.current?.click()}
        >
          Restore
        </Button>
      </Row>
      <input
        ref={restoreRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={(e) => handleRestore(e.target.files)}
      />
    </Card>
  );
}

function InfoSection() {
  const { data, isLoading } = useServiceStatus();
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

  const rows = [
    {
      label: "Scheduler",
      value: isLoading ? "-" : data?.running ? "Berjalan" : "Dihentikan",
      variant: data?.running ? "success" : "danger",
    },
    {
      label: "Mode aktif",
      value: data?.active_mode ?? "-",
      variant: "accent",
    },
    {
      label: "Status hari",
      value: data?.is_libur ? "Libur" : "Aktif",
      variant: data?.is_libur ? "warning" : "default",
    },
  ];

  return (
    <Card title="Info dan status" bodyStyle={{ padding: 0 }}>
      {rows.map((r) => (
        <Row key={r.label} title={r.label}>
          <Badge variant={r.variant as any} dot>
            {r.value}
          </Badge>
        </Row>
      ))}
      <Row title="Health check" last>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {healthStatus && (
            <Badge
              variant={
                healthStatus === "ok" ? "success" : healthStatus === "error" ? "danger" : "default"
              }
              dot
            >
              {healthStatus === "ok" ? "OK" : healthStatus === "error" ? "Error" : "Memeriksa"}
            </Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={12} />}
            onClick={checkHealth}
            loading={healthStatus === "checking"}
          >
            Cek
          </Button>
        </div>
      </Row>
    </Card>
  );
}

export function PengaturanPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="Pengaturan" description="Volume, keamanan akun, dan backup data" />
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
    </div>
  );
}
