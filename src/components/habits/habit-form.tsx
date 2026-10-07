"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, Segmented, SelectField, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { createHabitAction, updateHabitAction } from "@/server/actions/habits";

export type HabitFormValues = {
  name: string;
  kind: "build" | "reduce";
  tracking: "binary" | "quantity" | "duration" | "numeric";
  target: number;
  unit: string | null;
  scheduleDays: number[];
  baseline: number | null;
  isSensitive: boolean;
  goalId: string | null;
};

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const EMPTY: HabitFormValues = { name: "", kind: "build", tracking: "binary", target: 1, unit: null, scheduleDays: [0, 1, 2, 3, 4, 5, 6], baseline: null, isSensitive: false, goalId: null };

export function HabitFormDialog({
  open,
  onClose,
  habitId,
  initial,
  goals,
}: {
  open: boolean;
  onClose: () => void;
  habitId?: string;
  initial?: HabitFormValues;
  goals: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<HabitFormValues>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof HabitFormValues>(k: K, v: HabitFormValues[K]) => setValues((s) => ({ ...s, [k]: v }));

  const isReduce = values.kind === "reduce";
  const tracking = isReduce ? "quantity" : values.tracking;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const payload = { ...values, tracking, target: tracking === "binary" ? 1 : values.target };
    startTransition(async () => {
      const res = habitId ? await updateHabitAction({ id: habitId, data: payload }) : await createHabitAction(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success(habitId ? "Habit updated" : `“${values.name.trim()}” added`);
      if (!habitId) setValues(EMPTY);
      setErrors({});
      setFormError(undefined);
      onClose();
      router.refresh();
    });
  }

  const err = (k: string) => errors[k] ?? errors[`data.${k}`];

  return (
    <Dialog open={open} onClose={onClose} title={habitId ? "Edit habit" : "New habit"} description={isReduce ? "Track something you want to do less of. A slip is logged, never a reset." : "Something you want to do regularly."}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <Segmented
          name="kind"
          label="Habit type"
          value={values.kind}
          onChange={(v) => setValues((s) => ({ ...s, kind: v, target: v === "reduce" ? Math.max(0, s.baseline ?? 3) : s.target || 1, isSensitive: v === "reduce" ? true : s.isSensitive }))}
          options={[
            { value: "build", label: "Build a habit" },
            { value: "reduce", label: "Do less of something" },
          ]}
        />
        <TextField label="Name" value={values.name} onChange={(e) => set("name", e.target.value)} maxLength={80} error={err("name")} placeholder={isReduce ? "e.g. Late-night scrolling" : "e.g. Exercise"} autoFocus />

        {!isReduce ? (
          <SelectField label="How do you track it?" value={values.tracking} onChange={(e) => set("tracking", e.target.value as HabitFormValues["tracking"])}>
            <option value="binary">Done / not done</option>
            <option value="quantity">Count (e.g. glasses of water)</option>
            <option value="duration">Minutes</option>
            <option value="numeric">A number (e.g. hours slept)</option>
          </SelectField>
        ) : null}

        {tracking !== "binary" ? (
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={isReduce ? "Daily limit" : "Daily target"}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={Number.isFinite(values.target) ? values.target : ""}
              onChange={(e) => set("target", e.target.value === "" ? NaN : Number(e.target.value))}
              hint={isReduce ? "0 means stop completely" : undefined}
              error={err("target")}
            />
            <TextField label="Unit" optional value={values.unit ?? ""} onChange={(e) => set("unit", e.target.value || null)} maxLength={20} placeholder={tracking === "duration" ? "min" : "times"} error={err("unit")} />
          </div>
        ) : null}

        {isReduce ? (
          <TextField
            label="Roughly how often per day right now?"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={values.baseline ?? ""}
            onChange={(e) => set("baseline", e.target.value === "" ? null : Number(e.target.value))}
            hint="Your baseline. Progress is measured against it."
            optional
            error={err("baseline")}
          />
        ) : null}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-semibold">Which days?</legend>
          <div className="flex gap-1.5">
            {DAYS.map((d, i) => {
              const on = values.scheduleDays.includes(i);
              return (
                <label key={i} className={cn("grid size-10 cursor-pointer place-items-center rounded-xl text-[13px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-moss", on ? "bg-inverse text-inverse-ink" : "bg-sunken text-muted")}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    aria-label={DAY_NAMES[i]}
                    checked={on}
                    onChange={() => set("scheduleDays", on ? values.scheduleDays.filter((x) => x !== i) : [...values.scheduleDays, i])}
                  />
                  {d}
                </label>
              );
            })}
          </div>
          {err("scheduleDays") ? <p className="text-[12.5px] text-clay">{err("scheduleDays")}</p> : null}
        </fieldset>

        {goals.length ? (
          <SelectField label="Supports a goal" optional value={values.goalId ?? ""} onChange={(e) => set("goalId", e.target.value || null)} error={err("goalId")}>
            <option value="">None</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </SelectField>
        ) : null}

        <label className="flex items-start gap-3 rounded-xl bg-dusk-soft p-3 text-[13px]">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--dusk)]" checked={values.isSensitive} onChange={(e) => set("isSensitive", e.target.checked)} />
          <span>
            <span className="font-semibold">Sensitive</span> — leave out of exports unless you choose to include it.
          </span>
        </label>

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" pending={pending}>
            {habitId ? "Save changes" : "Add habit"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
