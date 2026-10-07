import { cn } from "@/lib/cn";
import type { RevisionState } from "@/domain/revisions";

export type MemoryStep = { step: number; dueDate: string; label: string; state: RevisionState };

/** The revision schedule for a topic as a path of stations (Figma "memory path"). */
export function MemoryPath({ steps }: { steps: MemoryStep[] }) {
  return (
    <ol className="flex items-start" aria-label="Revision schedule">
      {steps.map((s, i) => {
        const active = s.state === "due" || s.state === "overdue";
        return (
          <li key={s.step} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "block rounded-full",
                  active ? "size-[22px] border-4 border-card bg-ochre" : "size-4",
                  s.state === "done" && "bg-moss",
                  s.state === "skipped" && "bg-line",
                  s.state === "upcoming" && "border-[1.5px] border-line bg-card",
                )}
                aria-hidden
              />
              <span className={cn("font-mono text-[10.5px]", active ? "text-ochre" : "text-muted")}>{s.label}</span>
              <span className="sr-only">
                Revision {s.step}, {s.dueDate}: {s.state}
              </span>
            </div>
            {i < steps.length - 1 ? <span aria-hidden className={cn("mx-1 mt-[7px] h-0.5 flex-1", s.state === "done" ? "bg-moss" : "bg-line")} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
