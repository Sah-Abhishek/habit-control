import type { WellbeingPoint } from "@/server/services/insights";
import { formatNumber } from "@/domain/format";

type Series = { key: "sleepHours" | "mood" | "energy"; label: string; className: string; max: number };
const SERIES: Series[] = [
  { key: "sleepHours", label: "Sleep (h)", className: "stroke-dusk", max: 12 },
  { key: "mood", label: "Mood", className: "stroke-moss", max: 10 },
  { key: "energy", label: "Energy", className: "stroke-ochre", max: 10 },
];

function avg(points: WellbeingPoint[], key: Series["key"]) {
  const v = points.map((p) => p[key]).filter((x): x is number => x != null);
  return v.length ? { mean: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : null;
}

/** Each series on its own scale (sleep 0–12h, mood/energy 1–10). Gaps where nothing was logged. */
export function WellbeingChart({ points }: { points: WellbeingPoint[] }) {
  const W = 620;
  const H = 96;
  const n = points.length;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const paths = SERIES.map((s) => {
    let d = "";
    let pen = false;
    points.forEach((p, i) => {
      const v = p[s.key];
      if (v == null) {
        pen = false;
        return;
      }
      const yy = H - (Math.min(v, s.max) / s.max) * H;
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${yy.toFixed(1)} `;
      pen = true;
    });
    // Isolated days (no neighbours logged) would be invisible as a line, so draw them as dots.
    const dots = points
      .map((p, i) => ({ i, v: p[s.key] }))
      .filter(({ i, v }) => v != null && points[i - 1]?.[s.key] == null && points[i + 1]?.[s.key] == null)
      .map(({ i, v }) => ({ cx: x(i), cy: H - (Math.min(v as number, s.max) / s.max) * H }));
    return { ...s, d: d.trim(), dots };
  });
  const summary = SERIES.map((s) => {
    const a = avg(points, s.key);
    return a ? `${s.label} averaged ${formatNumber(a.mean)} over ${a.n} logged days` : `${s.label}: not logged`;
  }).join("; ");

  return (
    <figure>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {SERIES.map((s) => {
          const a = avg(points, s.key);
          return (
            <span key={s.key} className="flex items-center gap-1.5 text-[12px] text-muted">
              <svg width="14" height="4" aria-hidden>
                <line x1="0" x2="14" y1="2" y2="2" className={s.className} strokeWidth="3" />
              </svg>
              {s.label}
              {a ? <span className="font-mono text-ink">{formatNumber(a.mean)}</span> : null}
            </span>
          );
        })}
      </div>
      <svg viewBox={`0 -4 ${W} ${H + 8}`} className="h-auto w-full" role="img" aria-label={summary}>
        {paths.map((p) => (
          <g key={p.key}>
            {p.d ? <path d={p.d} fill="none" className={p.className} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null}
            {p.dots.map((d) => (
              <circle key={d.cx} cx={d.cx} cy={d.cy} r={2.5} className={p.className} strokeWidth={2} fill="none" />
            ))}
          </g>
        ))}
      </svg>
    </figure>
  );
}
