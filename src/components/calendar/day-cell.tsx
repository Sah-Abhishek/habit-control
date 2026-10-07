import Link from "next/link";
import { scoreBand } from "@/domain/day-score";
import { formatLocalDate } from "@/domain/dates";
import { formatDuration } from "@/domain/format";
import { cn } from "@/lib/cn";
import type { DayAggregate } from "@/server/services/today";

const BAND_TEXT = { none: "no data", light: "light day", medium: "steady day", full: "full day" } as const;

/** Accessible description: never rely on colour intensity alone. */
export function describeDay(a: DayAggregate): string {
  const parts = [formatLocalDate(a.date, "EEEE d MMMM")];
  if (a.isFuture) return `${parts[0]}, upcoming`;
  parts.push(BAND_TEXT[scoreBand(a.score)]);
  if (a.studySeconds) parts.push(`studied ${formatDuration(a.studySeconds)}${a.studyTargetMet ? ", target hit" : ""}`);
  if (a.habitsScheduled) parts.push(`${a.habitsSucceeded} of ${a.habitsScheduled} habits`);
  if (a.reduceOver) parts.push("over a limit");
  return parts.join(", ");
}

export function DayCell({ agg, href, inMonth, isToday, selected }: { agg: DayAggregate; href: string; inMonth: boolean; isToday: boolean; selected: boolean }) {
  const band = scoreBand(agg.score);
  const fill = agg.isFuture || band === "none" ? null : 0.15 + (agg.score ?? 0) * 0.85;
  const darkText = fill != null && fill > 0.6;
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={describeDay(agg)}
      aria-current={selected ? "date" : undefined}
      className={cn("group flex flex-col items-center gap-1 rounded-xl py-1 focus-visible:outline-2", !inMonth && "opacity-40")}
    >
      <span
        className={cn(
          "relative grid size-9 place-items-center rounded-full font-mono text-[12px] font-medium sm:size-10",
          fill == null && !agg.isFuture && "border border-hair",
          agg.isFuture && "border border-dashed border-line text-faint",
          isToday && "ring-2 ring-ink ring-offset-2 ring-offset-card",
          selected && !isToday && "ring-2 ring-ochre ring-offset-2 ring-offset-card",
          "group-hover:ring-2 group-hover:ring-line",
        )}
      >
        {fill != null ? <span aria-hidden className="absolute inset-0 rounded-full bg-moss" style={{ opacity: fill }} /> : null}
        <span className={cn("relative", darkText ? "text-moss-on" : "text-ink")}>{Number(agg.date.slice(8))}</span>
      </span>
      <span aria-hidden className="flex h-1 items-center gap-1">
        {agg.studyTargetMet ? <span className="size-1 rounded-full bg-ochre" /> : null}
        {agg.reduceOver ? <span className="h-0.5 w-2 rounded-full bg-clay" /> : null}
      </span>
    </Link>
  );
}

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-muted">
      <span className="flex items-center gap-1.5">
        <span className="flex gap-0.5" aria-hidden>
          {[0.3, 0.6, 1].map((o) => (
            <span key={o} className="size-3 rounded-full bg-moss" style={{ opacity: o }} />
          ))}
        </span>
        lighter → fuller day
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-ochre" /> study target hit
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="h-0.5 w-2.5 rounded-full bg-clay" /> over a limit
      </span>
    </div>
  );
}
