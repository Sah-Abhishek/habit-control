"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { deleteGoalAction, setGoalStatusAction, setPrimaryGoalAction } from "@/server/actions/goals";
import { GoalFormDialog, type GoalFormValues } from "./goal-form";

export function NewGoalButton({ today, label = "New goal", isFirst = false }: { today: string; label?: string; isFirst?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? (
        <GoalFormDialog open={open} onClose={() => setOpen(false)} today={today} initial={isFirst ? { title: "", description: "", startDate: today, targetDate: "", isPrimary: true } : undefined} />
      ) : null}
    </>
  );
}

type Status = "active" | "paused" | "completed" | "archived";
const STATUS_LABEL: Record<Status, string> = { active: "Active", paused: "Paused", completed: "Completed", archived: "Archived" };

export function GoalManage({ goalId, title, status, isPrimary, initial, today }: { goalId: string; title: string; status: Status; isPrimary: boolean; initial: GoalFormValues; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const canBePrimary = status === "active" || status === "paused";

  function changeStatus(next: Status) {
    startTransition(async () => {
      const res = await setGoalStatusAction({ id: goalId, status: next });
      if (!res.ok) return toast.error(res.error);
      const prev = res.data.previous;
      toast.success(`Goal marked ${STATUS_LABEL[next].toLowerCase()}`, async () => {
        const undo = await setGoalStatusAction({ id: goalId, status: prev });
        if (!undo.ok) toast.error(undo.error);
        router.refresh();
      });
      router.refresh();
    });
  }

  function makePrimary() {
    startTransition(async () => {
      const res = await setPrimaryGoalAction({ id: goalId });
      if (!res.ok) return toast.error(res.error);
      toast.success(`“${title}” is now your main goal`);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditing(true)}>
        Edit
      </Button>
      {canBePrimary && !isPrimary ? (
        <Button variant="secondary" size="sm" onClick={makePrimary} pending={pending}>
          Make main goal
        </Button>
      ) : null}
      <label className="sr-only" htmlFor="goal-status">
        Goal status
      </label>
      <select
        id="goal-status"
        value={status}
        disabled={pending}
        onChange={(e) => changeStatus(e.target.value as Status)}
        className="h-9 rounded-xl border border-line bg-card px-3 text-[13.5px] font-semibold"
      >
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <Button variant="ghost" size="sm" icon="trash" onClick={() => setDeleting(true)}>
        Delete
      </Button>
      {editing ? <GoalFormDialog open={editing} onClose={() => setEditing(false)} goalId={goalId} initial={initial} today={today} canBePrimary={canBePrimary} /> : null}
      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this goal?"
        description="This permanently removes the goal and its milestones. Linked subjects, habits and tasks are kept but unlinked. Archiving keeps everything instead."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirm.trim() !== title.trim()) return setError("Type the goal name exactly to confirm.");
            startTransition(async () => {
              const res = await deleteGoalAction({ id: goalId });
              if (!res.ok) return setError(res.error);
              toast.success(`“${title}” deleted`);
              router.replace("/goals");
              router.refresh();
            });
          }}
        >
          <FormError message={error} />
          <TextField label={`Type “${title}” to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" pending={pending} disabled={confirm.trim() !== title.trim()}>
              Delete forever
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
