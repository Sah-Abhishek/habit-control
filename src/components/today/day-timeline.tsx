import { formatClock } from "@/domain/format";
import type { TimelineBlock } from "@/server/services/today";

/** 24-hour lanes for the day so far: sleep, study, and a "now" marker. */
export function DayTimeline({ blocks, nowHour, studySeconds, targetMinutes, sleepMinutes }: { blocks: TimelineBlock[]; nowHour: number; studySeconds: number; targetMinutes: number; sleepMinutes: number | null }) {
  const pct = (h: number) => `${(Math.max(0, Math.min(24, h)) / 24) * 100}%`;
  const lane = (kind: "sleep" | "study") => blocks.filter((b) => (kind === "sleep" ? b.kind === "sleep" : b.kind !== "sleep"));
  const empty = blocks.length === 0;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-dusk" /> Sleep {sleepMinutes != null ? formatClock(sleepMinutes * 60) : "—"}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-ochre" /> Study {formatClock(studySeconds)}
          {targetMinutes > 0 ? ` / ${formatClock(targetMinutes * 60)}` : ""}
        </span>
      </div>
      {empty ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-[13.5px] text-muted">
          <span className="block font-serif text-[20px] text-ink">Your day draws itself here</span>
          Log last night’s sleep or start a session and the timeline fills in — no setup needed.
        </p>
      ) : (
        <div className="relative" role="img" aria-label={`Today so far: ${sleepMinutes != null ? `slept ${formatClock(sleepMinutes * 60)}, ` : ""}studied ${formatClock(studySeconds)}.`}>
          {(["sleep", "study"] as const).map((k) => (
            <div key={k} className="relative mb-2 h-[18px] rounded-md bg-sunken">
              {lane(k).map((b, i) => (
                <span
                  key={i}
                  className={`absolute top-0 h-full rounded-md ${b.kind === "sleep" ? "bg-dusk" : b.kind === "running" ? "animate-pulse bg-ochre/60" : "bg-ochre"}`}
                  style={{ left: pct(b.startHour), width: `max(4px, calc(${pct(b.endHour)} - ${pct(b.startHour)}))` }}
                />
              ))}
            </div>
          ))}
          <span aria-hidden className="absolute -top-1 bottom-[-4px] w-0.5 rounded bg-ink" style={{ left: pct(nowHour) }} />
          <div aria-hidden className="mt-1 flex justify-between font-mono text-[9.5px] text-faint">
            {["00", "06", "12", "18", "24"].map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
