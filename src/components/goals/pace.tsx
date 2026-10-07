import { Pill } from "@/components/ui/card";
import { formatPercent } from "@/domain/format";
import type { PaceStatus } from "@/domain/goals";

const PACE: Record<PaceStatus, { tone: "moss" | "ochre" | "clay"; label: string }> = {
  ahead: { tone: "moss", label: "Ahead" },
  on_pace: { tone: "moss", label: "On pace" },
  behind: { tone: "ochre", label: "Behind pace" },
};

export function PacePill({ status }: { status: PaceStatus | null }) {
  if (!status) return null;
  return <Pill tone={PACE[status].tone}>{PACE[status].label}</Pill>;
}

/** Actual progress as a filled bar, with a marker where steady work would be today. */
export function PaceBar({ progress, expected }: { progress: number; expected: number | null }) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="relative py-2">
      <div
        role="progressbar"
        aria-label={`Progress ${formatPercent(p)}${expected != null ? `, plan expects ${formatPercent(expected)} by today` : ""}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p * 100)}
        className="h-2.5 overflow-hidden rounded-full bg-sunken"
      >
        <div className="h-full rounded-full bg-moss" style={{ width: `${p * 100}%` }} />
      </div>
      {expected != null ? <span aria-hidden className="absolute top-0 h-[26px] w-0.5 -translate-x-1/2 rounded bg-ink" style={{ left: `${expected * 100}%` }} title={`Plan: ${formatPercent(expected)}`} /> : null}
    </div>
  );
}
