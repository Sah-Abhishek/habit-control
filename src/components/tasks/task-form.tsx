"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, SelectField, TextArea, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { createTaskAction, updateTaskAction } from "@/server/actions/tasks";
import type { TaskPickerOptions } from "@/server/services/tasks";

export type TaskFormValues = {
  title: string;
  notes: string;
  dueDate: string;
  priority: "low" | "medium" | "high" | "critical";
  goalId: string;
  subjectId: string;
  topicId: string;
  estimateMinutes: string;
};

export const EMPTY_TASK: TaskFormValues = { title: "", notes: "", dueDate: "", priority: "medium", goalId: "", subjectId: "", topicId: "", estimateMinutes: "" };

export function TaskFormDialog({
  open,
  onClose,
  taskId,
  initial,
  options,
}: {
  open: boolean;
  onClose: () => void;
  taskId?: string;
  initial?: Partial<TaskFormValues>;
  options: TaskPickerOptions;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<TaskFormValues>({ ...EMPTY_TASK, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof TaskFormValues>(k: K, v: TaskFormValues[K]) => setValues((s) => ({ ...s, [k]: v }));
  const topics = options.subjects.find((s) => s.id === values.subjectId)?.topics ?? [];
  const err = (k: string) => errors[k] ?? errors[`data.${k}`];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const payload = { ...values, estimateMinutes: values.estimateMinutes === "" ? null : values.estimateMinutes };
    startTransition(async () => {
      const res = taskId ? await updateTaskAction({ id: taskId, data: payload }) : await createTaskAction(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success(taskId ? "Task updated" : "Task added");
      if (!taskId) setValues({ ...EMPTY_TASK, ...initial });
      setErrors({});
      setFormError(undefined);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={taskId ? "Edit task" : "New task"}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField label="Title" value={values.title} onChange={(e) => set("title", e.target.value)} maxLength={200} error={err("title")} autoFocus placeholder="e.g. Solve PYQ set 3" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Due" type="date" optional value={values.dueDate} onChange={(e) => set("dueDate", e.target.value)} error={err("dueDate")} />
          <SelectField label="Priority" value={values.priority} onChange={(e) => set("priority", e.target.value as TaskFormValues["priority"])}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </SelectField>
        </div>
        <TextField
          label="Estimate (minutes)"
          type="number"
          inputMode="numeric"
          min={1}
          optional
          value={values.estimateMinutes}
          onChange={(e) => set("estimateMinutes", e.target.value)}
          error={err("estimateMinutes")}
        />
        {options.goals.length ? (
          <SelectField label="Goal" optional value={values.goalId} onChange={(e) => set("goalId", e.target.value)} error={err("goalId")}>
            <option value="">None</option>
            {options.goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </SelectField>
        ) : null}
        {options.subjects.length ? (
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Subject" optional value={values.subjectId} onChange={(e) => setValues((s) => ({ ...s, subjectId: e.target.value, topicId: "" }))} error={err("subjectId")}>
              <option value="">None</option>
              {options.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Topic" optional value={values.topicId} onChange={(e) => set("topicId", e.target.value)} disabled={!topics.length} error={err("topicId")}>
              <option value="">{values.subjectId ? (topics.length ? "None" : "No topics yet") : "Pick a subject first"}</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectField>
          </div>
        ) : null}
        <TextArea label="Notes" optional value={values.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} error={err("notes")} />
        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" pending={pending}>
            {taskId ? "Save changes" : "Add task"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
