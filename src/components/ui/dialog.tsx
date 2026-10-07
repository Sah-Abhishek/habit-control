"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icon";

/**
 * Modal built on native <dialog>: focus trapping, Escape to close and inert
 * background come from the browser.
 */
export function Dialog({ open, onClose, title, description, children, width = 520 }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className="m-auto w-[calc(100%-2rem)] rounded-[24px] bg-page p-0 text-ink backdrop:bg-black/40"
      style={{ maxWidth: width }}
    >
      {open ? (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h2 id="dialog-title" className="font-serif text-[28px] leading-tight">
                {title}
              </h2>
              {description ? <p className="mt-1 text-[13.5px] text-muted">{description}</p> : null}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-muted hover:bg-sunken hover:text-ink">
              <Icon name="x" size={18} />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
