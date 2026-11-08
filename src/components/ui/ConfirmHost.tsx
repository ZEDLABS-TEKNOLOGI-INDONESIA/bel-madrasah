import { useEffect, useState } from "react";
import { subscribeConfirm, type ConfirmRequest } from "../../lib/confirm";
import { Button } from "./Button";
import { Modal } from "./Modal";

export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      subscribeConfirm((next) => {
        setRequest(next);
        setOpen(true);
      }),
    [],
  );

  function settle(value: boolean) {
    request?.resolve(value);
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      onClose={() => settle(false)}
      title={request?.title ?? "Konfirmasi"}
      width={400}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "pre-line" }}>
          {request?.message}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" onClick={() => settle(false)}>
            {request?.cancelLabel ?? "Batal"}
          </Button>
          <Button variant={request?.danger ? "danger" : "primary"} onClick={() => settle(true)}>
            {request?.confirmLabel ?? "Lanjutkan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
