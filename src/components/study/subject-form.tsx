"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, SelectField, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { archiveSubjectAction, createSubjectAction, deleteSubjectAction, updateSubjectAction } from "@/server/actions/study";

type Values = { name: string; goalId: string | null; weight: number | null };
type GoalOption = { id: string; title: string };

function SubjectFormDialog({ open, onClose, subjectId, initial, goals }: { open: boolean; onClose: () => void; subjectId?: string; initial?: Values; goals: GoalOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Values>(initial ?? { name: "", goalId: null, weight: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const res = subjectId ? await updateSubjectAction({ id: subjectId, data: values }) : await createSubjectAction(values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success(subjectId ? "Subject updated" : `“${values.name.trim()}” added`);
      setErrors({});
      setFormError(undefined);
      onClose();
      if (!subjectId && res.data && typeof res.data === "object" && "id" in res.data) {
        router.push(`/study/${res.data.id}`);
      } else router.refresh();
    });
  }
  const err = (k: string) => errors[k] ?? errors[`data.${k}`];

  return (
    <Dialog open={open} onClose={onClose} title={subjectId ? "Edit subject" : "New subject"} description="A subject groups topics — e.g. DBMS, Operating Systems.">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField label="Name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} maxLength={80} error={err("name")} autoFocus placeholder="e.g. DBMS" />
        {goals.length ? (
          <SelectField label="Part of goal" optional value={values.goalId ?? ""} onChange={(e) => setValues({ ...values, goalId: e.target.value || null })} error={err("goalId")}>
            <option value="">None</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </SelectField>
        ) : null}
        <TextField
          label="Share of exam marks (%)"
          optional
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={values.weight ?? ""}
          onChange={(e) => setValues({ ...values, weight: e.target.value === "" ? null : Number(e.target.value) })}
          hint="Used to compare where your time goes with what the exam rewards."
          error={err("weight")}
        />
        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" pending={pending}>
            {subjectId ? "Save changes" : "Add subject"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function NewSubjectButton({ goals, label = "New subject", variant = "secondary" }: { goals: GoalOption[]; label?: string; variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon="plus" variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <SubjectFormDialog open={open} onClose={() => setOpen(false)} goals={goals} />
    </>
  );
}

export function SubjectManage({ subjectId, name, archived, initial, goals }: { subjectId: string; name: string; archived: boolean; initial: Values; goals: GoalOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function archive(next: boolean) {
    startTransition(async () => {
      const res = await archiveSubjectAction({ id: subjectId, archived: next });
      if (!res.ok) return toast.error(res.error);
      toast.success(
        next ? `“${name}” archived — sessions and topics kept` : `“${name}” restored`,
        next
          ? async () => {
              await archiveSubjectAction({ id: subjectId, archived: false });
              router.refresh();
            }
          : undefined,
      );
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditing(true)}>
        Edit
      </Button>
      <Button variant="secondary" size="sm" onClick={() => archive(!archived)} pending={pending}>
        {archived ? "Restore" : "Archive"}
      </Button>
      <Button variant="ghost" size="sm" icon="trash" onClick={() => setDeleting(true)}>
        Delete
      </Button>
      <SubjectFormDialog open={editing} onClose={() => setEditing(false)} subjectId={subjectId} initial={initial} goals={goals} />
      <Dialog open={deleting} onClose={() => setDeleting(false)} title="Delete this subject?" description="Its topics and scheduled revisions are removed permanently. Logged study sessions stay in your history, without a subject.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirm.trim() !== name.trim()) return setError("Type the subject name exactly to confirm.");
            startTransition(async () => {
              const res = await deleteSubjectAction({ id: subjectId });
              if (!res.ok) return setError(res.error);
              toast.success(`“${name}” deleted`);
              router.replace("/study");
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
