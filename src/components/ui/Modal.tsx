import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import React, { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, width = 480 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "var(--overlay)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.97, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            style={{
              width: "100%",
              maxWidth: width,
              maxHeight: "calc(100dvh - 32px)",
              display: "flex",
              flexDirection: "column",
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "0 16px 48px rgba(1, 4, 9, 0.3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
              <button
                onClick={onClose}
                aria-label="Tutup"
                className="row-hover"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 20, overflowY: "auto" }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
