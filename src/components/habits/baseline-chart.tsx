import { formatNumber } from "@/domain/format";

/**
 * Weekly averages for a reduce habit against the baseline. The shaded band between
 * each bar and the baseline is what was avoided.
 */
export function BaselineGapChart({ weeks, baseline, limit }: { weeks: Array<{ weekEnd: string; avg: number | null }>; baseline: number | null; limit: number }) {
  const W = 560;
  const H = 150;
  const values = weeks.map((w) => w.avg ?? 0);
  const max = Math.max(1, baseline ?? 0, limit, ...values) * 1.15;
  const y = (v: number) => H - (v / max) * H;
  const n = weeks.length;
  const slot = W / n;
  const bw = Math.min(28, slot * 0.6);
  const described = weeks.filter((w) => w.avg != null).map((w) => `week ending ${w.weekEnd}: ${formatNumber(w.avg)} per day`).join("; ");

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-auto w-full" role="img" aria-label={`Weekly average per day. ${baseline != null ? `Baseline ${formatNumber(baseline)}.` : ""} Limit ${formatNumber(limit)}. ${described}`}>
        {weeks.map((w, i) => {
          const x = i * slot + (slot - bw) / 2;
          if (w.avg == null) return <rect key={w.weekEnd} x={x} y={H - 2} width={bw} height={2} rx={1} className="fill-hair" />;
          const top = y(w.avg);
          const last = i === n - 1;
          return (
            <g key={w.weekEnd}>
              {baseline != null && w.avg < baseline ? <rect x={x} y={y(baseline)} width={bw} height={top - y(baseline)} className="fill-moss" opacity={0.16} /> : null}
              <rect x={x} y={top} width={bw} height={Math.max(1, H - top)} rx={5} className="fill-clay" opacity={last ? 1 : 0.42} />
            </g>
          );
        })}
        {baseline != null ? (
          <g>
            <line x1={0} x2={W} y1={y(baseline)} y2={y(baseline)} className="stroke-ink" strokeWidth={1.2} strokeDasharray="4 4" />
            <text x={0} y={y(baseline) - 5} className="fill-ink font-mono text-[10px]">
              baseline {formatNumber(baseline)}
            </text>
          </g>
        ) : null}
        <line x1={0} x2={W} y1={y(limit)} y2={y(limit)} className="stroke-faint" strokeWidth={1} strokeDasharray="1 3" />
        <text x={W} y={y(limit) - 5} textAnchor="end" className="fill-faint font-mono text-[10px]">
          limit {formatNumber(limit)}
        </text>
        <text x={0} y={H + 14} className="fill-faint font-mono text-[10px]">
          {n} weeks ago
        </text>
        <text x={W} y={H + 14} textAnchor="end" className="fill-faint font-mono text-[10px]">
          this week
        </text>
      </svg>
    </figure>
  );
}
