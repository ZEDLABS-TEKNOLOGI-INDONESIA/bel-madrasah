import { AnimatePresence, motion } from "framer-motion";
import { Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    "standalone" in window.navigator &&
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [iosShow, setIosShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isIos() && !isInStandaloneMode()) {
      const dismissed = localStorage.getItem("ios-install-dismissed");
      if (!dismissed) {
        timer = setTimeout(() => setIosShow(true), 1500);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismissIos() {
    localStorage.setItem("ios-install-dismissed", "1");
    setIosShow(false);
  }

  if (show) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          style={{
            position: "fixed",
            bottom: 80,
            left: 16,
            right: 16,
            zIndex: 999,
            background: "var(--card-gloss), var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            borderRadius: "var(--radius-xl)",
            padding: 16,
            boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Install Bel Madrasah</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Akses lebih cepat dari layar utama
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShow(false)}>
            Nanti
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              prompt?.prompt();
              setShow(false);
            }}
          >
            Install
          </Button>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (iosShow) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          style={{
            position: "fixed",
            bottom: 80,
            left: 16,
            right: 16,
            zIndex: 999,
            background: "var(--card-gloss), var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            borderRadius: "var(--radius-xl)",
            padding: 16,
            boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Install Bel Madrasah</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  Ketuk <Share size={13} style={{ flexShrink: 0 }} /> lalu pilih
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <SquarePlus size={13} style={{ flexShrink: 0 }} /> "Tambah ke Layar Utama"
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={dismissIos}>
              Tutup
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
