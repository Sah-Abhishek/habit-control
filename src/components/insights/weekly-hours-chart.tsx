import { formatLocalDate } from "@/domain/dates";
import { formatNumber } from "@/domain/format";
import type { WeekBar } from "@/domain/insights";

/** Hours per week as bars, with the weekly target as a dashed line. The current week is drawn as partial. */
export function WeeklyHoursChart({ weeks, targetHoursPerWeek }: { weeks: WeekBar[]; targetHoursPerWeek: number }) {
  const W = 640;
  const H = 170;
  const hours = weeks.map((w) => w.seconds / 3600);
  const max = Math.max(1, targetHoursPerWeek, ...hours) * 1.12;
  const y = (v: number) => H - (v / max) * H;
  const slot = W / weeks.length;
  const bw = Math.min(36, slot * 0.62);
  const step = max > 30 ? 10 : 5;
  const grid = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const full = weeks.filter((w) => !w.isCurrent);
  const hits = targetHoursPerWeek > 0 ? full.filter((w) => w.seconds / 3600 >= targetHoursPerWeek).length : 0;
  const summary = weeks.map((w) => `week of ${formatLocalDate(w.weekStart, "d MMM")}: ${formatNumber(w.seconds / 3600)} hours${w.isCurrent ? " so far" : ""}`).join("; ");

  return (
    <figure>
      <svg viewBox={`-28 -6 ${W + 30} ${H + 26}`} className="h-auto w-full" role="img" aria-label={`Study hours per week. Weekly target ${formatNumber(targetHoursPerWeek)} hours. ${summary}.`}>
        {grid.map((v) => (
          <g key={v}>
            <line x1={0} x2={W} y1={y(v)} y2={y(v)} className="stroke-hair" strokeWidth={1} />
            <text x={-6} y={y(v) + 3} textAnchor="end" className="fill-faint font-mono text-[9.5px]">
              {v}h
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const h = w.seconds / 3600;
          const x = i * slot + (slot - bw) / 2;
          const top = y(h);
          const hit = targetHoursPerWeek > 0 && h >= targetHoursPerWeek;
          return (
            <g key={w.weekStart}>
              {w.isCurrent ? (
                <rect x={x} y={top} width={bw} height={Math.max(1, H - top)} rx={6} className="fill-ochre stroke-ochre" fillOpacity={0.3} strokeDasharray="3 3" />
              ) : (
                <rect x={x} y={top} width={bw} height={Math.max(1, H - top)} rx={6} className="fill-ochre" opacity={hit ? 1 : 0.72} />
              )}
              <text x={x + bw / 2} y={H + 16} textAnchor="middle" className="fill-faint font-mono text-[9.5px]">
                {w.isCurrent ? "now" : formatLocalDate(w.weekStart, "d MMM")}
              </text>
            </g>
          );
        })}
        {targetHoursPerWeek > 0 ? (
          <g>
            <line x1={0} x2={W} y1={y(targetHoursPerWeek)} y2={y(targetHoursPerWeek)} className="stroke-moss" strokeWidth={1.5} strokeDasharray="6 4" />
            <text x={W} y={y(targetHoursPerWeek) - 5} textAnchor="end" className="fill-moss font-mono text-[10px]">
              target {formatNumber(targetHoursPerWeek)}h
            </text>
          </g>
        ) : null}
      </svg>
      <figcaption className="sr-only">{targetHoursPerWeek > 0 ? `Target met in ${hits} of ${full.length} complete weeks.` : "No weekly target set."}</figcaption>
    </figure>
  );
}

export function weeklySubtitle(weeks: WeekBar[], targetHoursPerWeek: number): string {
  const full = weeks.filter((w) => !w.isCurrent);
  const sorted = full.map((w) => w.seconds / 3600).sort((a, b) => a - b);
  const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0;
  const hits = full.filter((w) => w.seconds / 3600 >= targetHoursPerWeek).length;
  return targetHoursPerWeek > 0 ? `Hit target ${hits} of ${full.length} weeks · median ${formatNumber(median)}h` : `Median ${formatNumber(median)}h a week`;
}
