import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-[22px] bg-card p-5 sm:p-[22px]", className)} {...rest} />;
}

export function CardHeader({ title, meta, action, className }: { title: ReactNode; meta?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("mb-3 flex items-center gap-3", className)}>
      <h2 className="font-serif text-2xl leading-tight">{title}</h2>
      {meta ? <span className="font-mono text-[13px] text-moss">{meta}</span> : null}
      {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("label-mono", className)}>{children}</span>;
}

type PillTone = "moss" | "ochre" | "clay" | "dusk" | "neutral";
const PILL: Record<PillTone, string> = {
  moss: "bg-moss-soft text-moss",
  ochre: "bg-ochre-soft text-ochre",
  clay: "bg-clay-soft text-clay",
  dusk: "bg-dusk-soft text-dusk",
  neutral: "bg-sunken text-muted",
};
export function Pill({ tone = "neutral", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", PILL[tone], className)}>{children}</span>;
}

export function ProgressBar({ value, tone = "moss", label, className }: { value: number; tone?: "moss" | "ochre" | "clay" | "dusk"; label?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const color = { moss: "bg-moss", ochre: "bg-ochre", clay: "bg-clay", dusk: "bg-dusk" }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-sunken", className)}
    >
      <div className={cn("h-full rounded-full", color)} style={{ width: `${pct * 100}%` }} />
    </div>
  );
}
