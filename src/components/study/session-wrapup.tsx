"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, Segmented, SelectField, TextArea, TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { formatDuration } from "@/domain/format";
import { FOCUS_LABELS, METHOD_LABELS, STUDY_METHODS, type StudyMethod } from "@/domain/study";
import { deleteSessionAction, editSessionTimesAction, trimSessionAction, updateSessionDetailsAction } from "@/server/actions/study";
import type { SubjectOption, TopicOption } from "./log-session-dialog";

export type WrapUpSession = {
  id: string;
  durationSeconds: number;
  localDate: string;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  topicId: string | null;
  method: StudyMethod | null;
  focus: number | null;
  questionsAttempted: number | null;
  questionsCorrect: number | null;
  notes: string | null;
};

export type ForgottenTimer = { lastActivityIso: string; lastActivityLabel: string } | { lastActivityIso: null; lastActivityLabel: null };

const FOCUS_OPTIONS = ([1, 2, 3, 4, 5] as const).map((v) => ({ value: String(v), label: FOCUS_LABELS[v] }));

export function SessionWrapUp({
  session,
  subjects,
  topics,
  topicProgress,
  forgotten,
  today,
}: {
  session: WrapUpSession;
  subjects: SubjectOption[];
  topics: TopicOption[];
  /** Current progress per topic id, for the "how far did you get" slider. */
  topicProgress: Record<string, number>;
  forgotten: ForgottenTimer | null;
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState({
    subjectId: session.subjectId ?? "",
    topicId: session.topicId ?? "",
    method: session.method ?? "",
    focus: session.focus ? String(session.focus) : "",
    questionsAttempted: session.questionsAttempted?.toString() ?? "",
    questionsCorrect: session.questionsCorrect?.toString() ?? "",
    notes: session.notes ?? "",
  });
  const initialProgress = v.topicId ? (topicProgress[v.topicId] ?? 0) : 0;
  const [progress, setProgress] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [times, setTimes] = useState({ date: session.localDate, startTime: session.startTime, endTime: session.endTime });
  const [editingTimes, setEditingTimes] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dismissedForgotten, setDismissedForgotten] = useState(false);
  const subjectTopics = useMemo(() => topics.filter((t) => t.subjectId === v.subjectId), [topics, v.subjectId]);

  function save(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const res = await updateSessionDetailsAction({
        id: session.id,
        details: { ...v, subjectId: v.subjectId || null, topicId: v.topicId || null, method: v.method || null, focus: v.focus || null },
        topicProgress: v.topicId && progress != null ? progress : null,
      });
      if (!res.ok) {
        setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, m]) => [k.replace(/^details\./, ""), m])));
        setFormError(res.error);
        return;
      }
      toast.success("Session saved");
      router.push("/study");
      router.refresh();
    });
  }

  function trim() {
    if (!forgotten?.lastActivityIso) return;
    startTransition(async () => {
      const res = await trimSessionAction({ id: session.id, endedAt: forgotten.lastActivityIso! });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Trimmed to ${formatDuration(res.data.durationSeconds)}`);
      setDismissedForgotten(true);
      router.refresh();
    });
  }

  function saveTimes(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await editSessionTimesAction({ id: session.id, ...times });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(`Times updated · ${formatDuration(res.data.durationSeconds)}`);
      setEditingTimes(false);
      setErrors({});
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {forgotten && !dismissedForgotten ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-ochre-soft p-4">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-ochre" />
          <div className="flex-1">
            <p className="text-[14px] font-semibold">That’s a long one — {formatDuration(session.durationSeconds)}.</p>
            <p className="text-[13px] leading-5 text-muted">
              {forgotten.lastActivityIso
                ? `Your last tap was at ${forgotten.lastActivityLabel}. Did the timer keep running after you stopped?`
                : "Did the timer keep running after you stopped? You can correct the end time."}
            </p>
            <div className="mt-2 flex flex-wrap gap-4">
              {forgotten.lastActivityIso ? (
                <button type="button" onClick={trim} disabled={pending} className="text-[13px] font-semibold text-ochre">
                  Trim to {forgotten.lastActivityLabel}
                </button>
              ) : (
                <button type="button" onClick={() => setEditingTimes(true)} className="text-[13px] font-semibold text-ochre">
                  Correct the times
                </button>
              )}
              <button type="button" onClick={() => setDismissedForgotten(true)} className="text-[13px] font-semibold text-muted">
                Keep {formatDuration(session.durationSeconds)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <form noValidate onSubmit={save} className="flex flex-col gap-5">
        <FormError message={formError} />
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-semibold">How focused were you?</p>
          <Segmented name="focus" label="Focus" value={v.focus} onChange={(focus) => setV({ ...v, focus })} options={FOCUS_OPTIONS} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label="Subject" optional value={v.subjectId} onChange={(e) => setV({ ...v, subjectId: e.target.value, topicId: "" })} error={errors.subjectId}>
            <option value="">None</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Topic" optional value={v.topicId} disabled={!subjectTopics.length} onChange={(e) => (setV({ ...v, topicId: e.target.value }), setProgress(null))} error={errors.topicId}>
            <option value="">None</option>
            {subjectTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Method" optional value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })} error={errors.method}>
            <option value="">Not set</option>
            {STUDY_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Questions attempted" optional type="number" inputMode="numeric" min={0} value={v.questionsAttempted} onChange={(e) => setV({ ...v, questionsAttempted: e.target.value })} error={errors.questionsAttempted} />
          <TextField label="Correct" optional type="number" inputMode="numeric" min={0} value={v.questionsCorrect} onChange={(e) => setV({ ...v, questionsCorrect: e.target.value })} error={errors.questionsCorrect} />
        </div>

        {v.topicId ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between">
              <label htmlFor="topic-progress" className="text-[14px] font-semibold">
                Topic progress
              </label>
              <span className="font-mono text-[13px] text-moss">
                {initialProgress}% → {progress ?? initialProgress}%
              </span>
            </div>
            <input id="topic-progress" type="range" min={0} max={100} step={5} value={progress ?? initialProgress} onChange={(e) => setProgress(Number(e.target.value))} className="accent-[var(--moss)]" />
          </div>
        ) : null}

        <TextArea label="Notes" optional value={v.notes} maxLength={2000} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="What to revisit, what clicked…" error={errors.notes} />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" pending={pending}>
            Save
          </Button>
          <Button variant="secondary" onClick={() => setEditingTimes((o) => !o)}>
            {editingTimes ? "Close times" : "Edit times"}
          </Button>
          <Button variant="ghost" icon="trash" className="ml-auto" onClick={() => setDeleting(true)}>
            Delete session
          </Button>
        </div>
        <p className="text-[12px] text-faint">Everything here is optional — the time is already saved.</p>
      </form>

      {editingTimes ? (
        <form noValidate onSubmit={saveTimes} className="flex flex-col gap-3 rounded-2xl bg-card p-4">
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Day" type="date" max={today} value={times.date} onChange={(e) => setTimes({ ...times, date: e.target.value })} error={errors.date} />
            <TextField label="Start" type="time" value={times.startTime} onChange={(e) => setTimes({ ...times, startTime: e.target.value })} error={errors.startTime} />
            <TextField label="End" type="time" value={times.endTime} onChange={(e) => setTimes({ ...times, endTime: e.target.value })} error={errors.endTime} hint="Earlier than start = past midnight" />
          </div>
          <div>
            <Button type="submit" variant="secondary" size="sm" pending={pending}>
              Save times
            </Button>
          </div>
        </form>
      ) : null}

      <Dialog open={deleting} onClose={() => setDeleting(false)} title="Delete this session?" description="Its time and question counts are removed from your history and insights.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            pending={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteSessionAction({ id: session.id });
                if (!res.ok) return void toast.error(res.error);
                toast.success("Session deleted");
                router.replace("/study");
                router.refresh();
              })
            }
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
