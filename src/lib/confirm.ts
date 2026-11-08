export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const EVENT = "app-confirm-request";

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent<ConfirmRequest>(EVENT, { detail: { ...options, resolve } }),
    );
  });
}

export function subscribeConfirm(listener: (request: ConfirmRequest) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<ConfirmRequest>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
