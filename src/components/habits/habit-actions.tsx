"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { archiveHabitAction, deleteHabitAction } from "@/server/actions/habits";
import { HabitFormDialog, type HabitFormValues } from "./habit-form";

export function NewHabitButton({ goals, label = "New habit", variant = "primary" }: { goals: Array<{ id: string; title: string }>; label?: string; variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon="plus" variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <HabitFormDialog open={open} onClose={() => setOpen(false)} goals={goals} />
    </>
  );
}

/** Edit / archive / delete for the habit detail page. */
export function HabitManage({ habitId, name, archived, initial, goals }: { habitId: string; name: string; archived: boolean; initial: HabitFormValues; goals: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function archive(next: boolean) {
    startTransition(async () => {
      const res = await archiveHabitAction({ id: habitId, archived: next });
      if (!res.ok) return toast.error(res.error);
      toast.success(next ? `“${name}” archived — history kept` : `“${name}” restored`, next ? async () => void (await archiveHabitAction({ id: habitId, archived: false }), router.refresh()) : undefined);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditing(true)} disabled={archived}>
        Edit
      </Button>
      <Button variant="secondary" size="sm" onClick={() => archive(!archived)} pending={pending}>
        {archived ? "Restore" : "Archive"}
      </Button>
      <Button variant="ghost" size="sm" icon="trash" onClick={() => setDeleting(true)}>
        Delete
      </Button>
      <HabitFormDialog open={editing} onClose={() => setEditing(false)} habitId={habitId} initial={initial} goals={goals} />
      <Dialog open={deleting} onClose={() => setDeleting(false)} title="Delete this habit?" description="This permanently removes the habit and every day you logged. Archiving keeps the history instead.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirm.trim() !== name.trim()) return setError("Type the habit name exactly to confirm.");
            startTransition(async () => {
              const res = await deleteHabitAction({ id: habitId });
              if (!res.ok) return setError(res.error);
              toast.success(`“${name}” deleted`);
              router.replace("/habits");
              router.refresh();
            });
          }}
        >
          <FormError message={error} />
          <TextField label={`Type “${name}” to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" pending={pending} disabled={confirm.trim() !== name.trim()}>
              Delete forever
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
