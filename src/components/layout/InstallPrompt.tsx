import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show) return null;

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
