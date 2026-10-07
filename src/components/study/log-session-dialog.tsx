"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, SelectField, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { METHOD_LABELS, STUDY_METHODS } from "@/domain/study";
import { logPastSessionAction } from "@/server/actions/study";

export type TopicOption = { id: string; name: string; subjectId: string; subjectName: string };
export type SubjectOption = { id: string; name: string };

/** Record a session that wasn't timed (e.g. studied away from the app). */
export function LogSessionButton({ subjects, topics, today, defaultSubjectId }: { subjects: SubjectOption[]; topics: TopicOption[]; today: string; defaultSubjectId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ date: today, startTime: "", endTime: "", subjectId: defaultSubjectId ?? "", topicId: "", method: "", questionsAttempted: "", questionsCorrect: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const subjectTopics = useMemo(() => topics.filter((t) => t.subjectId === v.subjectId), [topics, v.subjectId]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const local: Record<string, string> = {};
    if (!v.startTime) local.startTime = "Required";
    if (!v.endTime) local.endTime = "Required";
    if (Object.keys(local).length) return setErrors(local);
    startTransition(async () => {
      const res = await logPastSessionAction({ ...v, subjectId: v.subjectId || null, topicId: v.topicId || null, method: v.method || null });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success("Session logged");
      setOpen(false);
      setErrors({});
      setFormError(undefined);
      setV((s) => ({ ...s, startTime: "", endTime: "", questionsAttempted: "", questionsCorrect: "" }));
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" icon="plus" onClick={() => setOpen(true)}>
        Log past session
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Log a past session" description="For study you didn’t time. An end time earlier than the start means it ran past midnight.">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormError message={formError} />
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Day" type="date" max={today} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} error={errors.date} />
            <TextField label="Start" type="time" value={v.startTime} onChange={(e) => setV({ ...v, startTime: e.target.value })} error={errors.startTime} />
            <TextField label="End" type="time" value={v.endTime} onChange={(e) => setV({ ...v, endTime: e.target.value })} error={errors.endTime} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Subject" optional value={v.subjectId} onChange={(e) => setV({ ...v, subjectId: e.target.value, topicId: "" })} error={errors.subjectId}>
              <option value="">None</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Topic" optional value={v.topicId} onChange={(e) => setV({ ...v, topicId: e.target.value })} disabled={!subjectTopics.length} error={errors.topicId}>
              <option value="">None</option>
              {subjectTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectField>
          </div>
          <SelectField label="Method" optional value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>
            <option value="">Not set</option>
            {STUDY_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Questions attempted" optional type="number" inputMode="numeric" min={0} value={v.questionsAttempted} onChange={(e) => setV({ ...v, questionsAttempted: e.target.value })} error={errors.questionsAttempted} />
            <TextField label="Correct" optional type="number" inputMode="numeric" min={0} value={v.questionsCorrect} onChange={(e) => setV({ ...v, questionsCorrect: e.target.value })} error={errors.questionsCorrect} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              Log session
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
