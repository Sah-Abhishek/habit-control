"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { completeRevisionAction, reopenRevisionAction, setRevisionDueDateAction, snoozeRevisionAction } from "@/server/actions/study";

export type DueRevisionItem = { id: string; step: number; overdueDays: number; topicName: string; subjectId: string; subjectName: string };

/** Revisions due today/overdue with one-tap Done and Snooze (both undoable). */
export function RevisionList({ items }: { items: DueRevisionItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [visible, hide] = useOptimistic(items, (state, id: string) => state.filter((r) => r.id !== id));

  function done(r: DueRevisionItem) {
    startTransition(async () => {
      hide(r.id);
      const res = await completeRevisionAction({ id: r.id });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${r.topicName} revised`, async () => {
        const undo = await reopenRevisionAction({ id: r.id });
        if (!undo.ok) toast.error(undo.error);
        router.refresh();
      });
      router.refresh();
    });
  }

  function snooze(r: DueRevisionItem) {
    startTransition(async () => {
      hide(r.id);
      const res = await snoozeRevisionAction({ id: r.id });
      if (!res.ok) return void toast.error(res.error);
      const previous = res.data.previousDueDate;
      toast.success(`${r.topicName} moved to tomorrow`, async () => {
        const undo = await setRevisionDueDateAction({ id: r.id, dueDate: previous });
        if (!undo.ok) toast.error(undo.error);
        router.refresh();
      });
      router.refresh();
    });
  }

  if (!visible.length) return <p className="text-[13.5px] text-muted">Nothing to revise today. Completing a topic schedules its revisions automatically.</p>;

  return (
    <ul className="divide-y divide-hair">
      {visible.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <Link href={`/study/${r.subjectId}`} className="block truncate text-[14px] font-semibold hover:underline">
              {r.topicName}
            </Link>
            <p className="truncate text-[12px] text-faint">
              {r.subjectName} · Rev {r.step}
              {r.overdueDays > 0 ? <span className="text-ochre"> · {r.overdueDays === 1 ? "1 day late" : `${r.overdueDays} days late`}</span> : null}
            </p>
          </div>
          <button type="button" disabled={pending} onClick={() => snooze(r)} className="rounded-xl px-2.5 py-1.5 text-[12.5px] font-medium text-muted hover:bg-sunken hover:text-ink disabled:opacity-50">
            Tomorrow
          </button>
          <button type="button" disabled={pending} onClick={() => done(r)} aria-label={`Mark ${r.topicName} revised`} className="grid size-8 place-items-center rounded-full border-[1.5px] border-line text-muted hover:border-moss hover:text-moss disabled:opacity-50">
            <Icon name="check" size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}
