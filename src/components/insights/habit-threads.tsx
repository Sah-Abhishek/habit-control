import Link from "next/link";
import { Trail } from "@/components/habits/trail";
import { formatPercent } from "@/domain/format";
import type { HabitThread } from "@/server/services/insights";

const ARROW = { up: "↗", down: "↘", flat: "→" } as const;
const TREND_LABEL = { up: "improving", down: "slipping", flat: "steady" } as const;

export function HabitThreads({ threads }: { threads: HabitThread[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {threads.map((t) => (
        <li key={t.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
          <Link href={`/habits/${t.id}`} className="truncate text-[13.5px] font-medium hover:underline">
            {t.name}
          </Link>
          <div className="min-w-0 overflow-hidden">
            <Trail ticks={t.ticks} kind={t.kind} tickWidth={3} gap={1.5} className="h-[18px]" />
          </div>
          <span className="w-20 text-right font-mono text-[12px] text-muted">
            {formatPercent(t.rate)}
            {t.trend ? (
              <span className={t.trend === "up" ? "text-moss" : t.trend === "down" ? "text-clay" : ""} title={TREND_LABEL[t.trend]}>
                {" "}
                {ARROW[t.trend]}
                <span className="sr-only"> {TREND_LABEL[t.trend]} vs the previous 45 days</span>
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
