import Link from "next/link";
import type { HabitSummary } from "@/server/services/habits";
import { formatNumber, formatPercent } from "@/domain/format";
import { HabitLogControl } from "./habit-log-control";
import { Trail } from "./trail";

export function habitMeta(s: HabitSummary): string {
  const h = s.habit;
  if (h.kind === "reduce" && s.reduction) {
    const r = s.reduction;
    const limit = `Limit ${formatNumber(h.target)}`;
    if (r.weekAvg == null) return `${limit} · just started`;
    const change = r.prevWeekAvg != null && r.weekChange != null ? `, ${r.weekChange >= 0 ? "down" : "up"} from ${formatNumber(r.prevWeekAvg)}` : "";
    return `${limit} · 7-day avg ${formatNumber(r.weekAvg)}${change}`;
  }
  const c = s.c30;
  if (c.scheduled === 0) return "Starts today";
  const unit = h.tracking === "binary" ? "" : ` · target ${formatNumber(h.target)} ${h.unit ?? (h.tracking === "duration" ? "min" : "")}`.trimEnd();
  return `${c.successes} of last ${c.scheduled} days${unit}`;
}

export function HabitRow({ summary, showLink = true }: { summary: HabitSummary; showLink?: boolean }) {
  const h = summary.habit;
  return (
    <li className="flex items-center gap-3.5 py-3">
      {summary.scheduledToday ? (
        <HabitLogControl habit={{ id: h.id, name: h.name, kind: h.kind, tracking: h.tracking, target: h.target, unit: h.unit }} value={summary.todayValue} />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-[11px] text-faint" title="Not scheduled today">
          off
        </span>
      )}
      <div className="min-w-0 flex-1">
        {showLink ? (
          <Link href={`/habits/${h.id}`} className="block truncate text-[15px] font-semibold hover:underline">
            {h.name}
          </Link>
        ) : (
          <p className="truncate text-[15px] font-semibold">{h.name}</p>
        )}
        <p className="truncate text-[12.5px] text-muted">{habitMeta(summary)}</p>
      </div>
      <Trail ticks={summary.trail7} kind={h.kind} />
      <span className="sr-only">30-day consistency {formatPercent(summary.c30.rate)}</span>
    </li>
  );
}
