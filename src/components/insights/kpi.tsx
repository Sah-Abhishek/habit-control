import { Label } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export function Kpi({ label, value, sub, tone = "moss" }: { label: string; value: string; sub: string; tone?: "moss" | "ochre" | "clay" | "muted" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[18px] bg-card p-4">
      <Label>{label}</Label>
      <p className="truncate font-serif text-[32px] leading-[1.05]">{value}</p>
      <p className={cn("truncate font-mono text-[11.5px]", { moss: "text-moss", ochre: "text-ochre", clay: "text-clay", muted: "text-muted" }[tone])}>{sub}</p>
    </div>
  );
}
