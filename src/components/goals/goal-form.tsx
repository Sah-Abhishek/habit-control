"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, TextArea, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { createGoalAction, updateGoalAction } from "@/server/actions/goals";

export type GoalFormValues = { title: string; description: string; startDate: string; targetDate: string; isPrimary: boolean };

export function GoalFormDialog({
  open,
  onClose,
  goalId,
  initial,
  today,
  canBePrimary = true,
}: {
  open: boolean;
  onClose: () => void;
  goalId?: string;
  initial?: GoalFormValues;
  today: string;
  canBePrimary?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const empty: GoalFormValues = { title: "", description: "", startDate: today, targetDate: "", isPrimary: false };
  const [values, setValues] = useState<GoalFormValues>(initial ?? empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof GoalFormValues>(k: K, v: GoalFormValues[K]) => setValues((s) => ({ ...s, [k]: v }));
  const err = (k: string) => errors[k] ?? errors[`data.${k}`];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (values.targetDate && values.startDate && values.targetDate < values.startDate) {
      setErrors({ targetDate: "Pick a date on or after the start date" });
      return;
    }
    startTransition(async () => {
      const res = goalId ? await updateGoalAction({ id: goalId, data: values }) : await createGoalAction(values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success(goalId ? "Goal updated" : `“${values.title.trim()}” created`);
      setErrors({});
      setFormError(undefined);
      onClose();
      if (!goalId && res.data && typeof res.data === "object" && "id" in res.data) router.push(`/goals/${res.data.id}`);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={goalId ? "Edit goal" : "New goal"} description="A long-term outcome. Break it into milestones to track progress.">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField label="Goal" value={values.title} onChange={(e) => set("title", e.target.value)} maxLength={120} error={err("title")} autoFocus placeholder="e.g. Crack GATE CSE" />
        <TextArea label="Why it matters" optional value={values.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} error={err("description")} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Start" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} error={err("startDate")} />
          <TextField label="Target date" type="date" optional min={values.startDate || undefined} value={values.targetDate} onChange={(e) => set("targetDate", e.target.value)} error={err("targetDate")} hint="Enables pace tracking" />
        </div>
        {canBePrimary ? (
          <label className="flex items-start gap-3 rounded-xl bg-moss-soft p-3 text-[13px]">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--moss)]" checked={values.isPrimary} onChange={(e) => set("isPrimary", e.target.checked)} />
            <span>
              <span className="font-semibold">Main goal</span> — shown on Today. Replaces your current main goal.
            </span>
          </label>
        ) : null}
        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" pending={pending}>
            {goalId ? "Save changes" : "Create goal"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
