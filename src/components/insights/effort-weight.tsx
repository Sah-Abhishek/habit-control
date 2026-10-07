import type { SubjectEffort } from "@/domain/insights";
import { formatPercent } from "@/domain/format";

/** Time share (bar) vs share of exam marks (thin grey bar) per subject. */
export function EffortWeight({ rows }: { rows: SubjectEffort[] }) {
  const scale = Math.max(0.01, ...rows.map((r) => Math.max(r.timeShare, r.weightShare ?? 0)));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{r.name}</span>
            <span className={`font-mono text-[11px] ${r.underInvested ? "text-clay" : "text-muted"}`}>
              {formatPercent(r.timeShare)} time{r.weightShare != null ? ` · ${formatPercent(r.weightShare)} marks` : " · no weight"}
            </span>
          </div>
          <div aria-hidden className="flex flex-col gap-[3px]">
            <span className={`h-1.5 rounded-full ${r.underInvested ? "bg-clay" : "bg-moss"}`} style={{ width: `${(r.timeShare / scale) * 100}%`, minWidth: r.timeShare > 0 ? 4 : 0 }} />
            {r.weightShare != null ? <span className="h-1 rounded-full bg-faint/45" style={{ width: `${(r.weightShare / scale) * 100}%` }} /> : null}
          </div>
          {r.underInvested ? <span className="sr-only">Getting less time than its weight suggests.</span> : null}
        </li>
      ))}
    </ul>
  );
}
