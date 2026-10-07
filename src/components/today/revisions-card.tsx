"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Card, CardHeader, Pill } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { completeRevisionAction, reopenRevisionAction } from "@/server/actions/study";

export type RevisionItem = { id: string; step: number; topicName: string; subjectName: string; subjectId: string; overdueDays: number };

export function RevisionsCard({ items }: { items: RevisionItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [visible, hide] = useOptimistic(items, (state: RevisionItem[], id: string) => state.filter((r) => r.id !== id));

  function done(r: RevisionItem) {
    startTransition(async () => {
      hide(r.id);
      const res = await completeRevisionAction({ id: r.id });
      if (!res.ok) return toast.error(res.error);
      toast.success(`${r.topicName} revised`, async () => {
        const undo = await reopenRevisionAction({ id: r.id });
        if (!undo.ok) toast.error(undo.error);
        router.refresh();
      });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader title="Revisions due" meta={visible.length ? String(visible.length) : undefined} />
      {visible.length === 0 ? (
        <p className="text-[13.5px] text-muted">Nothing due. Marking a topic complete schedules its revisions automatically.</p>
      ) : (
        <ul className="divide-y divide-hair">
          {visible.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`/study/${r.subjectId}`} className="block truncate text-[14px] font-semibold hover:underline">
                  {r.topicName}
                </Link>
                <p className="text-[12px] text-faint">
                  {r.subjectName}
                  {r.overdueDays > 0 ? ` · ${r.overdueDays}d overdue` : ""}
                </p>
              </div>
              <Pill tone="ochre" className="font-mono">
                REV {r.step}
              </Pill>
              <button type="button" onClick={() => done(r)} aria-label={`Mark ${r.topicName} revision ${r.step} done`} className="grid size-8 place-items-center rounded-full border border-line text-muted hover:border-moss hover:text-moss">
                <Icon name="check" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
