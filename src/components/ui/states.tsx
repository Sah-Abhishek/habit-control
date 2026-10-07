import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

/** "Nothing here yet" — always explains why and offers the next step. */
export function EmptyState({ title, body, action, className }: { title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-2 rounded-2xl border border-dashed border-line p-5", className)}>
      <p className="text-[15px] font-semibold">{title}</p>
      {body ? <p className="text-[13.5px] leading-5 text-muted">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, body, action, className }: { title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-start gap-2 rounded-2xl bg-card p-5", className)}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-[10px] bg-clay-soft text-clay">
          <Icon name="alert" size={16} />
        </span>
        <p className="text-[14.5px] font-semibold">{title}</p>
      </div>
      {body ? <p className="text-[13px] leading-5 text-muted">{body}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-full bg-sunken", className)} />;
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-[22px] bg-card p-[22px]", className)} aria-busy>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-6 w-56" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3" />
      ))}
    </div>
  );
}
