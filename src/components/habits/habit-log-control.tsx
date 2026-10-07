"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/domain/format";
import { logHabitAction } from "@/server/actions/habits";

export type LoggableHabit = {
  id: string;
  name: string;
  kind: "build" | "reduce";
  tracking: "binary" | "quantity" | "duration" | "numeric";
  target: number;
  unit: string | null;
};

/**
 * One-tap logging for today. Updates optimistically, confirms with a toast that
 * offers Undo, and rolls back with an explanation if the server rejects it.
 */
export function HabitLogControl({ habit, value, date, size = "md" }: { habit: LoggableHabit; value: number; date?: string; size?: "md" | "lg" }) {
  const toast = useToast();
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<string>("");

  function submit(mode: "set" | "increment", amount: number, message: (v: number) => string) {
    const next = mode === "set" ? Math.max(0, amount) : Math.max(0, optimistic + amount);
    startTransition(async () => {
      setOptimistic(next);
      const res = await logHabitAction({ habitId: habit.id, date, mode, value: amount });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const previous = res.data.previous;
      toast.success(message(res.data.value), async () => {
        const undo = await logHabitAction({ habitId: habit.id, date, mode: "set", value: previous });
        if (!undo.ok) toast.error(undo.error);
      });
    });
  }

  const dim = size === "lg" ? "size-11" : "size-9";

  if (habit.kind === "build" && habit.tracking === "binary") {
    const done = optimistic >= 1;
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${habit.name}: ${done ? "done" : "not done"}`}
        disabled={pending}
        onClick={() => submit("set", done ? 0 : 1, (v) => (v ? `${habit.name} done` : `${habit.name} unticked`))}
        className={cn(
          "grid shrink-0 place-items-center rounded-full transition-colors disabled:opacity-60",
          dim,
          done ? "bg-moss text-moss-on" : "border-[1.5px] border-line text-transparent hover:border-moss hover:text-moss/40",
        )}
      >
        <Icon name="check" size={18} strokeWidth={2.2} />
      </button>
    );
  }

  if (habit.kind === "reduce" || habit.tracking === "quantity") {
    const over = habit.kind === "reduce" && optimistic > habit.target;
    return (
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`Remove one from ${habit.name}`}
          disabled={pending || optimistic <= 0}
          onClick={() => submit("increment", -1, (v) => `${habit.name}: ${formatNumber(v)}`)}
          className="grid size-8 place-items-center rounded-full text-muted hover:bg-sunken disabled:opacity-40"
        >
          <Icon name="minus" size={16} />
        </button>
        <output
          aria-live="polite"
          aria-label={`${habit.name} today`}
          className={cn(
            "grid place-items-center rounded-full font-mono text-[15px] font-medium",
            dim,
            habit.kind === "reduce" ? (over ? "bg-clay text-card" : "bg-clay-soft text-clay") : optimistic >= habit.target ? "bg-moss text-moss-on" : "bg-moss-soft text-moss",
          )}
        >
          {formatNumber(optimistic)}
        </output>
        <button
          type="button"
          aria-label={`Add one to ${habit.name}`}
          disabled={pending}
          onClick={() => submit("increment", 1, (v) => `${habit.name}: ${formatNumber(v)}${habit.kind === "reduce" ? ` (limit ${formatNumber(habit.target)})` : ""}`)}
          className="grid size-8 place-items-center rounded-full text-muted hover:bg-sunken disabled:opacity-40"
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
    );
  }

  // duration / numeric: enter an amount
  const unit = habit.unit ?? (habit.tracking === "duration" ? "min" : "");
  return (
    <form
      className="flex shrink-0 items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(draft);
        if (draft.trim() === "" || !Number.isFinite(n) || n < 0) {
          toast.error("Enter a number of 0 or more.");
          return;
        }
        submit("set", n, (v) => `${habit.name}: ${formatNumber(v)} ${unit}`.trim());
        setDraft("");
      }}
    >
      <label className="sr-only" htmlFor={`log-${habit.id}`}>
        {habit.name} amount in {unit || "units"}
      </label>
      <input
        id={`log-${habit.id}`}
        inputMode="decimal"
        placeholder={optimistic ? formatNumber(optimistic) : "0"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className={cn("w-16 rounded-xl border border-line bg-card px-2 py-1.5 text-right font-mono text-[14px]", optimistic >= habit.target && optimistic > 0 && "border-moss")}
      />
      <span className="w-7 text-[12px] text-faint">{unit}</span>
      <button type="submit" disabled={pending || draft === ""} aria-label={`Save ${habit.name}`} className="grid size-8 place-items-center rounded-full bg-inverse text-inverse-ink disabled:opacity-30">
        <Icon name="check" size={15} />
      </button>
    </form>
  );
}
