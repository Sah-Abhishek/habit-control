import type { HourCell } from "@/domain/insights";
import { MIN_SESSIONS_PER_HOUR } from "@/domain/insights";
import { formatNumber } from "@/domain/format";

const hh = (h: number) => String(h).padStart(2, "0");

/** 24 cells, intensity = average focus. Hours with too few sessions are faint so noise isn't mistaken for signal. */
export function FocusHours({ cells }: { cells: HourCell[] }) {
  const reliable = cells.filter((c) => c.sessions >= MIN_SESSIONS_PER_HOUR && c.avgFocus != null);
  const label = reliable.length
    ? `Average focus by hour started. ${reliable.map((c) => `${hh(c.hour)}:00 ${formatNumber(c.avgFocus)} (${c.sessions} sessions)`).join("; ")}.`
    : "Not enough rated sessions per hour yet.";
  return (
    <div role="img" aria-label={label}>
      <div className="flex gap-[3px]">
        {cells.map((c) => {
          const strong = c.sessions >= MIN_SESSIONS_PER_HOUR && c.avgFocus != null;
          const intensity = c.avgFocus != null ? (c.avgFocus - 1) / 4 : 0;
          return (
            <span
              key={c.hour}
              title={c.sessions ? `${hh(c.hour)}:00 · ${c.sessions} session${c.sessions === 1 ? "" : "s"}${c.avgFocus != null ? ` · focus ${formatNumber(c.avgFocus)}` : ""}${strong ? "" : " · too few to trust"}` : `${hh(c.hour)}:00 · no sessions`}
              className={`h-[30px] flex-1 rounded-[4px] ${c.sessions ? "bg-ochre" : "bg-sunken"}`}
              style={c.sessions ? { opacity: strong ? 0.2 + intensity * 0.8 : 0.12 } : undefined}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-faint" aria-hidden>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  );
}
