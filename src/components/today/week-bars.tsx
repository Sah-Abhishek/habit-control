import { addLocalDays, diffLocalDays, formatLocalDate, type LocalDate } from "@/domain/dates";
import { formatClock } from "@/domain/format";
import { cn } from "@/lib/cn";

/** Study per day this week against the daily target; future days are dashed. */
export function WeekBars({ weekStart, seconds, today, targetMinutes }: { weekStart: LocalDate; seconds: Map<LocalDate, number>; today: LocalDate; targetMinutes: number }) {
  const days = Array.from({ length: 7 }, (_, i) => addLocalDays(weekStart, i));
  const max = Math.max(targetMinutes * 60, ...days.map((d) => seconds.get(d) ?? 0), 1);
  const total = days.reduce((s, d) => s + (seconds.get(d) ?? 0), 0);
  return (
    <div>
      <p className="mb-3 font-mono text-[12px] text-muted">
        {formatClock(total)}
        {targetMinutes > 0 ? ` / ${formatClock(targetMinutes * 60 * 7)}` : ""}
      </p>
      <ol className="flex items-end gap-2" aria-label="Study this week">
        {days.map((d) => {
          const future = diffLocalDays(d, today) > 0;
          const s = seconds.get(d) ?? 0;
          return (
            <li key={d} className="flex flex-1 flex-col items-center gap-1.5" aria-label={`${formatLocalDate(d, "EEEE")}: ${future ? "upcoming" : formatClock(s)}`}>
              <span className={cn("relative h-[70px] w-full overflow-hidden rounded-[7px]", future ? "border border-dashed border-line" : "bg-sunken")}>
                {!future && s > 0 ? <span className={cn("absolute inset-x-0 bottom-0", d === today ? "bg-ochre" : "bg-ochre/60")} style={{ height: `${(s / max) * 100}%` }} /> : null}
              </span>
              <span className={cn("font-mono text-[10.5px]", d === today ? "text-ink" : "text-faint")}>{formatLocalDate(d, "EEEEE")}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
