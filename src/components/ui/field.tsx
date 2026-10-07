import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border bg-card px-3.5 py-2.5 text-[15px] text-ink placeholder:text-faint transition-colors focus:outline-none focus:ring-2 focus:ring-moss/40 disabled:opacity-60";

type FieldShellProps = { label: string; hint?: ReactNode; error?: string; optional?: boolean; children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode };

/** Label + control + hint/error wired up with ids for screen readers. */
export function FieldShell({ label, hint, error, optional, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
        {optional ? <span className="ml-1 font-normal text-faint">optional</span> : null}
      </label>
      {children({ id, describedBy: [errId, hintId].filter(Boolean).join(" ") || undefined, invalid: !!error })}
      {error ? (
        <p id={errId} className="text-[12.5px] text-clay">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12px] text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Common = { label: string; hint?: ReactNode; error?: string; optional?: boolean };

export function TextField({ label, hint, error, optional, className, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cn(control, invalid ? "border-clay" : "border-line", className)} {...rest} />
      )}
    </FieldShell>
  );
}

export function TextArea({ label, hint, error, optional, className, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cn(control, "min-h-20 resize-y", invalid ? "border-clay" : "border-line", className)} {...rest} />
      )}
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, optional, className, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cn(control, "appearance-auto", invalid ? "border-clay" : "border-line", className)} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

/** Pill-style single choice, keyboard accessible as a radio group. */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  name: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange?: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-[14px] bg-sunken p-1">
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex-1 cursor-pointer rounded-[10px] text-center font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-moss",
            size === "sm" ? "px-3 py-1.5 text-[12.5px]" : "px-3 py-2 text-[13.5px]",
            o.value === value ? "bg-card font-semibold text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          <input type="radio" className="sr-only" name={name} value={o.value} checked={o.value === value} onChange={() => onChange?.(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-clay-soft px-3.5 py-2.5 text-[13px] text-clay">
      {message}
    </p>
  );
}
