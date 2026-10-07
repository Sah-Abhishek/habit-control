"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { formatLocalDate } from "@/domain/dates";
import { cn } from "@/lib/cn";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  moveMilestoneAction,
  setMilestoneCompleteAction,
  updateMilestoneAction,
} from "@/server/actions/goals";

export type MilestoneView = { id: string; title: string; targetDate: string | null; progress: number; completed: boolean };

type FormValues = { title: string; targetDate: string; progress: string };

function MilestoneDialog({ open, onClose, goalId, milestone }: { open: boolean; onClose: () => void; goalId: string; milestone?: MilestoneView }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<FormValues>({ title: milestone?.title ?? "", targetDate: milestone?.targetDate ?? "", progress: String(milestone?.progress ?? 0) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const err = (k: string) => errors[`data.${k}`] ?? errors[k];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const data = { title: values.title, targetDate: values.targetDate, progress: values.progress === "" ? 0 : values.progress };
      const res = milestone ? await updateMilestoneAction({ id: milestone.id, data }) : await createMilestoneAction({ goalId, data });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success(milestone ? "Milestone updated" : "Milestone added");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={milestone ? "Edit milestone" : "New milestone"} width={460}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField label="Milestone" value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} maxLength={120} error={err("title")} autoFocus placeholder="e.g. Complete syllabus" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="By" type="date" optional value={values.targetDate} onChange={(e) => setValues((v) => ({ ...v, targetDate: e.target.value }))} error={err("targetDate")} />
          <TextField label="Progress %" type="number" inputMode="numeric" min={0} max={100} value={values.progress} onChange={(e) => setValues((v) => ({ ...v, progress: e.target.value }))} error={err("progress")} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" pending={pending}>
            {milestone ? "Save" : "Add milestone"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ProgressEditor({ milestone }: { milestone: MilestoneView }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(milestone.progress);
  const [pending, startTransition] = useTransition();

  function commit(next: number) {
    if (next === milestone.progress) return;
    startTransition(async () => {
      const res = await updateMilestoneAction({ id: milestone.id, data: { title: milestone.title, targetDate: milestone.targetDate ?? "", progress: next } });
      if (!res.ok) {
        setValue(milestone.progress);
        return toast.error(res.error);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={pending}
        aria-label={`${milestone.title} progress`}
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={() => commit(value)}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) commit(value);
        }}
        className="h-1.5 flex-1 cursor-pointer accent-[var(--moss)]"
      />
      <span className="w-10 text-right font-mono text-[13px] font-medium">{value}%</span>
    </div>
  );
}

/** Milestones as stations on a vertical route. The first unfinished one is "current". */
export function MilestoneRoute({ goalId, milestones }: { goalId: string; milestones: MilestoneView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MilestoneView | null>(null);
  const [pending, startTransition] = useTransition();
  const currentId = milestones.find((m) => !m.completed)?.id;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return toast.error(res.error ?? "Something went wrong");
      if (success) toast.success(success);
      router.refresh();
    });
  }

  function remove(m: MilestoneView) {
    startTransition(async () => {
      const res = await deleteMilestoneAction({ id: m.id });
      if (!res.ok) return toast.error(res.error);
      toast.success(`“${m.title}” removed`, async () => {
        const undo = await createMilestoneAction({ goalId, data: { title: m.title, targetDate: m.targetDate ?? "", progress: m.progress } });
        if (!undo.ok) toast.error(undo.error);
        router.refresh();
      });
      router.refresh();
    });
  }

  return (
    <div>
      {milestones.length === 0 ? (
        <p className="mb-3 text-[13.5px] leading-5 text-muted">Break this goal into 3–6 milestones — big checkpoints like “Complete syllabus” or “First mock test”. Goal progress is the average of their progress.</p>
      ) : (
        <ol className={cn("mb-3", pending && "opacity-70")}>
          {milestones.map((m, i) => {
            const current = m.id === currentId;
            const last = i === milestones.length - 1;
            return (
              <li key={m.id} className="flex gap-3">
                <div className="flex w-5 flex-col items-center pt-1" aria-hidden>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border-2",
                      current ? "size-4 border-card bg-ochre ring-2 ring-ochre/30" : m.completed ? "size-3 border-moss bg-moss" : m.progress > 0 ? "size-3 border-moss bg-card" : "size-3 border-line bg-card",
                    )}
                  />
                  {!last ? <span className={cn("mt-1 w-0.5 flex-1", m.completed ? "bg-moss" : "bg-line")} /> : null}
                </div>
                <div className="group min-w-0 flex-1 pb-5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={m.completed}
                      aria-label={`${m.title}: ${m.completed ? "complete" : "not complete"}`}
                      onClick={() => run(() => setMilestoneCompleteAction({ id: m.id, complete: !m.completed, goalId }), m.completed ? "Milestone reopened" : "Milestone complete")}
                      className={cn("grid size-5 shrink-0 place-items-center rounded-[7px]", m.completed ? "bg-moss text-moss-on" : "border-[1.5px] border-line hover:border-moss")}
                    >
                      {m.completed ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}
                    </button>
                    <p className={cn("min-w-0 flex-1 truncate text-[15px] font-semibold", m.completed && "text-muted")}>{m.title}</p>
                    <span className={cn("font-mono text-[13px] font-medium", current ? "text-ochre" : "text-muted")}>{m.progress}%</span>
                    <span className="flex opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <button type="button" aria-label={`Move ${m.title} up`} disabled={i === 0 || pending} onClick={() => run(() => moveMilestoneAction({ id: m.id, direction: "up" }))} className="rounded-lg p-1 text-muted hover:bg-sunken disabled:opacity-30">
                        <Icon name="up" size={15} />
                      </button>
                      <button type="button" aria-label={`Move ${m.title} down`} disabled={last || pending} onClick={() => run(() => moveMilestoneAction({ id: m.id, direction: "down" }))} className="rounded-lg p-1 text-muted hover:bg-sunken disabled:opacity-30">
                        <Icon name="down" size={15} />
                      </button>
                      <button type="button" aria-label={`Edit ${m.title}`} onClick={() => setEditing(m)} className="rounded-lg p-1 text-muted hover:bg-sunken">
                        <Icon name="edit" size={15} />
                      </button>
                      <button type="button" aria-label={`Delete ${m.title}`} onClick={() => remove(m)} className="rounded-lg p-1 text-muted hover:bg-sunken hover:text-clay">
                        <Icon name="trash" size={15} />
                      </button>
                    </span>
                  </div>
                  <p className="mt-0.5 pl-7 text-[12px] text-faint">{m.targetDate ? `by ${formatLocalDate(m.targetDate, "d MMM yyyy")}` : "no date"}</p>
                  {!m.completed ? (
                    <div className="mt-2 pl-7">
                      <ProgressEditor key={`${m.id}-${m.progress}`} milestone={m} />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Button variant="secondary" size="sm" icon="plus" onClick={() => setAdding(true)}>
        Add milestone
      </Button>
      {adding ? <MilestoneDialog open={adding} onClose={() => setAdding(false)} goalId={goalId} /> : null}
      {editing ? <MilestoneDialog key={editing.id} open onClose={() => setEditing(null)} goalId={goalId} milestone={editing} /> : null}
    </div>
  );
}
