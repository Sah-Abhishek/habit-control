import type { DayState } from "@/domain/habits";
import { cn } from "@/lib/cn";

const HEIGHT: Record<DayState, string> = {
  done: "h-3.5",
  clear: "h-3.5",
  within: "h-2.5",
  partial: "h-2.5",
  over: "h-3.5",
  missed: "h-1",
  pending: "h-1",
  off: "h-1",
  future: "h-1",
};

function color(state: DayState, kind: "build" | "reduce") {
  if (state === "over") return "bg-clay";
  if (state === "done" || state === "clear") return kind === "reduce" ? "bg-moss" : "bg-moss";
  if (state === "partial" || state === "within") return "bg-moss/50";
  if (state === "off" || state === "future") return "bg-hair";
  return "bg-line";
}

const LABEL: Record<DayState, string> = {
  done: "done",
  clear: "clear",
  within: "within limit",
  partial: "partly done",
  over: "over limit",
  missed: "missed",
  pending: "not yet",
  off: "not scheduled",
  future: "",
};

/** The "thread": one tick per day. A gap is a missed day; the thread keeps going. */
export function Trail({ ticks, kind, tickWidth = 4, gap = 3, className }: { ticks: Array<{ date: string; state: DayState }>; kind: "build" | "reduce"; tickWidth?: number; gap?: number; className?: string }) {
  const summary = ticks.filter((t) => t.state !== "off" && t.state !== "future");
  const good = summary.filter((t) => ["done", "clear", "within"].includes(t.state)).length;
  return (
    <div className={cn("flex items-end", className)} style={{ gap }} role="img" aria-label={`${good} of ${summary.length} scheduled days on track`}>
      {ticks.map((t) => (
        <span key={t.date} title={`${t.date}: ${LABEL[t.state]}`} className={cn("rounded-full", HEIGHT[t.state], color(t.state, kind))} style={{ width: tickWidth }} />
      ))}
    </div>
  );
}
