import Link from "next/link";
import type { RangeKey } from "@/domain/insights";
import { cn } from "@/lib/cn";

const OPTIONS: Array<{ key: RangeKey; label: string; full: string }> = [
  { key: "7d", label: "7d", full: "Last 7 days" },
  { key: "30d", label: "30d", full: "Last 30 days" },
  { key: "90d", label: "90d", full: "Last 90 days" },
  { key: "1y", label: "1y", full: "Last 12 months" },
];

export function RangeSwitch({ value }: { value: RangeKey }) {
  return (
    <nav aria-label="Time range" className="flex gap-0.5 rounded-xl bg-sunken p-1">
      {OPTIONS.map((o) => (
        <Link
          key={o.key}
          href={`/insights?range=${o.key}`}
          aria-label={o.full}
          aria-current={o.key === value ? "page" : undefined}
          scroll={false}
          className={cn("rounded-[9px] px-3.5 py-2 font-mono text-[12.5px] font-medium", o.key === value ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink")}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
