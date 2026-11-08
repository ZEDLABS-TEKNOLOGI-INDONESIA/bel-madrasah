import { AnimatePresence, motion } from "framer-motion";
import { Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { APP } from "../../lib/app.config";
import { Button } from "../ui/Button";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

const DISMISS_KEY = "install-dismissed-at";
const COOLDOWN = 7 * 24 * 60 * 60_000;

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < COOLDOWN;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const isMobile = useIsMobile();
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isIos()) timer = setTimeout(() => setVisible(true), 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      setVisible(false);
      return;
    }
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    setVisible(false);
    await deferred.prompt();
    setDeferred(null);
  }

  const position = isMobile
    ? { left: 16, right: 16, bottom: "calc(72px + env(safe-area-inset-bottom))" }
    : { right: 24, bottom: 24, width: 380 };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          style={{
            position: "fixed",
            zIndex: 999,
            ...position,
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
            boxShadow: "0 8px 24px rgba(1, 4, 9, 0.25)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <img src={APP.logo} alt="" width={32} height={32} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Install {APP.name}</div>
            {deferred ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Akses lebih cepat dari layar utama
              </div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 4,
                }}
              >
                Ketuk <Share size={13} /> lalu pilih <SquarePlus size={13} /> Tambah ke Layar Utama
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={dismiss}>
            {deferred ? "Nanti" : "Tutup"}
          </Button>
          {deferred && (
            <Button variant="primary" size="sm" onClick={install}>
              Install
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
