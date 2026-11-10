import { Download, RefreshCw, Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useServiceStatus } from "../../hooks/useConfig";
import { api } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
import { modeLabel, type Tone } from "../../lib/constants";
import { errorMessage } from "../../lib/errors";
import { VolumeSlider } from "../audio/VolumeSlider";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { PageHeader } from "../ui/PageHeader";
import { SettingRow } from "../ui/SettingRow";

const MIN_PASSWORD = 8;

function PasswordSection() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD) {
      toast.error(`Password baru minimal ${MIN_PASSWORD} karakter`);
      return;
    }
    if (newPassword !== confirmPassword) {
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
      setConfirmPassword("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const mismatch = confirmPassword !== "" && newPassword !== confirmPassword;

  return (
    <Card title="Ganti password">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Password lama" htmlFor="old-password">
          <input
            id="old-password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field
          label="Password baru"
          htmlFor="new-password"
          hint={`Minimal ${MIN_PASSWORD} karakter`}
        >
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
          />
        </Field>
        <Field
          label="Konfirmasi password baru"
          htmlFor="confirm-password"
          error={mismatch ? "Password tidak cocok" : undefined}
        >
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="primary" type="submit" loading={loading}>
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

  function resetInput() {
    if (restoreRef.current) restoreRef.current.value = "";
  }

  function handleBackup() {
    window.location.href = "/api/backup";
  }

  async function handleRestore(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith(".json")) {
      toast.error("File harus berformat JSON");
      resetInput();
      return;
    }
    const ok = await confirmAction({
      title: "Restore backup",
      message: `Restore jadwal dari ${file.name}? Data jadwal saat ini akan ditimpa.`,
      confirmLabel: "Restore",
      danger: true,
    });
    if (!ok) {
      resetInput();
      return;
    }

    setRestoreLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      await api.upload("/api/restore", form);
      toast.success("Jadwal berhasil direstore");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRestoreLoading(false);
      resetInput();
    }
  }

  return (
    <Card title="Backup dan restore" bodyStyle={{ padding: 0 }}>
      <SettingRow title="Download backup" desc="Ekspor semua jadwal ke file JSON">
        <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={handleBackup}>
          Download
        </Button>
      </SettingRow>
      <SettingRow title="Restore backup" desc="Import jadwal dari file JSON backup" last>
        <Button
          variant="secondary"
          size="sm"
          icon={<Upload size={13} />}
          loading={restoreLoading}
          onClick={() => restoreRef.current?.click()}
        >
          Restore
        </Button>
      </SettingRow>
      <input
        ref={restoreRef}
        type="file"
        accept=".json"
        aria-label="Pilih file backup"
        style={{ display: "none" }}
        onChange={(e) => handleRestore(e.target.files)}
      />
    </Card>
  );
}

type HealthStatus = "ok" | "error" | "checking" | null;

function InfoSection() {
  const { data, isLoading } = useServiceStatus();
  const [healthStatus, setHealthStatus] = useState<HealthStatus>(null);

  async function checkHealth() {
    setHealthStatus("checking");
    try {
      const res = await fetch("/healthz", { credentials: "include" });
      setHealthStatus(res.ok ? "ok" : "error");
    } catch {
      setHealthStatus("error");
    }
  }

  const rows: { label: string; value: string; variant: Tone }[] = [
    {
      label: "Scheduler",
      value: isLoading ? "-" : data?.running ? "Berjalan" : "Dihentikan",
      variant: data?.running ? "success" : "danger",
    },
    {
      label: "Mode aktif",
      value: modeLabel(data?.active_mode),
      variant: "accent",
    },
    {
      label: "Status hari",
      value: data?.is_libur ? "Libur" : "Aktif",
      variant: data?.is_libur ? "warning" : "default",
    },
    {
      label: "Versi",
      value: data?.version ?? "-",
      variant: "default",
    },
  ];

  const healthVariant: Tone =
    healthStatus === "ok" ? "success" : healthStatus === "error" ? "danger" : "default";
  const healthLabel =
    healthStatus === "ok" ? "OK" : healthStatus === "error" ? "Error" : "Memeriksa";

  return (
    <Card title="Info dan status" bodyStyle={{ padding: 0 }}>
      {rows.map((r) => (
        <SettingRow key={r.label} title={r.label}>
          <Badge variant={r.variant} dot>
            {r.value}
          </Badge>
        </SettingRow>
      ))}
      <SettingRow title="Health check" last>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {healthStatus && (
            <Badge variant={healthVariant} dot>
              {healthLabel}
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
      </SettingRow>
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
          <VolumeSlider />
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
