import { AnimatePresence, LazyMotion, m } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { loadMotionFeatures } from "../../lib/motion";

const FOCUSABLE = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, width = 480 }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;

    const focusables = () =>
      dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

    (bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? dialog)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open]);

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <AnimatePresence>
        {open && (
          <m.div
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
            <m.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              tabIndex={-1}
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
                outline: "none",
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
                  title="Tutup"
                  className="row-hover"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex",
                    padding: 4,
                    borderRadius: "var(--radius)",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <div ref={bodyRef} style={{ padding: 20, overflowY: "auto" }}>
                {children}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
