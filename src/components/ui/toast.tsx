"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";

type Toast = { id: number; message: string; tone: "success" | "error"; undo?: () => void | Promise<void> };
type ToastApi = { success: (message: string, undo?: Toast["undo"]) => void; error: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/** Feedback for completed actions. Undo replaces confirmation dialogs for reversible actions. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-2), { ...t, id }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, undo) => push({ message, tone: "success", undo }),
      error: (message) => push({ message, tone: "error" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const [undoing, setUndoing] = useState(false);
  useEffect(() => {
    const timer = setTimeout(onDone, toast.undo ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [onDone, toast.undo]);

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-inverse px-3.5 py-3 text-inverse-ink shadow-lg"
    >
      <span className={`grid size-6 shrink-0 place-items-center rounded-[10px] ${toast.tone === "error" ? "bg-clay" : "bg-moss"} text-moss-on`}>
        <Icon name={toast.tone === "error" ? "alert" : "check"} size={14} />
      </span>
      <p className="flex-1 text-[13.5px] font-medium">{toast.message}</p>
      {toast.undo ? (
        <button
          type="button"
          disabled={undoing}
          className="text-[13.5px] font-bold text-ochre disabled:opacity-50"
          onClick={async () => {
            setUndoing(true);
            try {
              await toast.undo?.();
            } finally {
              onDone();
            }
          }}
        >
          Undo
        </button>
      ) : (
        <button type="button" aria-label="Dismiss" className="text-inverse-ink/60 hover:text-inverse-ink" onClick={onDone}>
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
