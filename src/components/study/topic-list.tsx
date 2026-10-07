"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Pill, ProgressBar } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  createTopicAction,
  deleteTopicAction,
  moveTopicAction,
  renameTopicAction,
  setTopicCompletedAction,
  setTopicProgressAction,
} from "@/server/actions/study";
import { MemoryPath, type MemoryStep } from "./memory-path";
import { StartSessionButton } from "./start-session-button";

export type TopicItem = {
  id: string;
  name: string;
  progress: number;
  status: "not_started" | "in_progress" | "completed";
  revisions: MemoryStep[];
  nextRevision: { label: string; tone: "ochre" | "neutral" } | null;
};

function statusTag(t: TopicItem) {
  if (t.nextRevision) return <Pill tone={t.nextRevision.tone}>{t.nextRevision.label}</Pill>;
  if (t.status === "completed") return <Pill tone="moss">Completed</Pill>;
  if (t.status === "not_started") return <Pill>Not started</Pill>;
  return null;
}

function TopicRow({ topic, first, last, archived }: { topic: TopicItem; first: boolean; last: boolean; archived: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(topic.name);
  const [progress, setProgress] = useState(topic.progress);
  const [optimistic, setOptimistic] = useOptimistic(topic.progress);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const done = topic.status === "completed";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success?: string, undo?: () => Promise<unknown>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong");
        return;
      }
      if (success) toast.success(success, undo ? async () => void (await undo(), router.refresh()) : undefined);
      router.refresh();
    });
  }

  function saveProgress(e: FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) return setError("Use a whole number from 0 to 100.");
    setError(undefined);
    const prev = topic.progress;
    startTransition(async () => {
      setOptimistic(progress);
      const res = await setTopicProgressAction({ id: topic.id, progress });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${topic.name}: ${progress}%`, async () => {
        await setTopicProgressAction({ id: topic.id, progress: prev });
        router.refresh();
      });
      router.refresh();
    });
  }

  function saveName(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the topic a name.");
    if (name.trim() === topic.name) return;
    setError(undefined);
    run(() => renameTopicAction({ id: topic.id, name }), "Topic renamed");
  }

  const pct = optimistic / 100;
  return (
    <li className="py-3.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`topic-${topic.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className={cn("truncate text-[15px] font-semibold", done && "text-muted")}>{topic.name}</span>
          {statusTag(topic)}
        </button>
        <span className={cn("font-mono text-[13px] font-medium", optimistic === 0 ? "text-faint" : "text-ink")}>{optimistic}%</span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? `Close ${topic.name} options` : `Edit ${topic.name}`} className="rounded-lg p-1 text-muted hover:bg-sunken hover:text-ink">
          <Icon name={open ? "x" : "more"} size={16} />
        </button>
      </div>
      <ProgressBar value={pct} tone={done || pct >= 0.6 ? "moss" : "ochre"} label={`${topic.name} progress`} className="mt-2" />

      {open ? (
        <div id={`topic-${topic.id}`} className="mt-3 flex flex-col gap-3 rounded-2xl bg-sunken p-3.5">
          <FormError message={error} />
          <form onSubmit={saveName} className="flex items-center gap-2">
            <label htmlFor={`name-${topic.id}`} className="sr-only">
              Topic name
            </label>
            <input id={`name-${topic.id}`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-[14px]" />
            <Button type="submit" size="sm" variant="secondary" disabled={pending || name.trim() === topic.name}>
              Rename
            </Button>
          </form>
          {!done ? (
            <form onSubmit={saveProgress} className="flex items-center gap-3">
              <label htmlFor={`progress-${topic.id}`} className="text-[13px] font-semibold">
                Progress
              </label>
              <input id={`progress-${topic.id}`} type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="flex-1 accent-[var(--moss)]" />
              <span className="w-10 text-right font-mono text-[13px]">{progress}%</span>
              <Button type="submit" size="sm" variant="secondary" disabled={pending || progress === topic.progress}>
                Save
              </Button>
            </form>
          ) : null}
          {topic.revisions.length ? <MemoryPath steps={topic.revisions} /> : null}
          <div className="flex flex-wrap items-center gap-2">
            {!archived ? <StartSessionButton topicId={topic.id} size="sm" variant="primary" label="Study this" /> : null}
            <Button
              size="sm"
              variant={done ? "secondary" : "accent"}
              icon="check"
              disabled={pending}
              onClick={() =>
                run(
                  () => setTopicCompletedAction({ id: topic.id, completed: !done }),
                  done ? `${topic.name} reopened — pending revisions removed` : `${topic.name} complete — revisions scheduled`,
                  done ? undefined : () => setTopicCompletedAction({ id: topic.id, completed: false }),
                )
              }
            >
              {done ? "Reopen" : "Mark complete"}
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" disabled={first || pending} onClick={() => run(() => moveTopicAction({ id: topic.id, direction: "up" }))} aria-label={`Move ${topic.name} up`} className="rounded-lg p-2 text-muted hover:bg-card disabled:opacity-30">
                <Icon name="up" size={16} />
              </button>
              <button type="button" disabled={last || pending} onClick={() => run(() => moveTopicAction({ id: topic.id, direction: "down" }))} aria-label={`Move ${topic.name} down`} className="rounded-lg p-2 text-muted hover:bg-card disabled:opacity-30">
                <Icon name="down" size={16} />
              </button>
              <button type="button" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${topic.name}`} className="rounded-lg p-2 text-muted hover:bg-card hover:text-clay">
                <Icon name="trash" size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete “${topic.name}”?`} description="Its progress and revision schedule are removed. Sessions logged against it stay in your history.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            pending={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteTopicAction({ id: topic.id });
                if (!res.ok) return void toast.error(res.error);
                setConfirmDelete(false);
                toast.success(`“${topic.name}” deleted`);
                router.refresh();
              })
            }
          >
            Delete topic
          </Button>
        </div>
      </Dialog>
    </li>
  );
}

export function TopicList({ subjectId, topics, archived }: { subjectId: string; topics: TopicItem[]; archived: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function add(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!name.trim()) return setError("Give the topic a name.");
    setError(undefined);
    startTransition(async () => {
      const res = await createTopicAction({ subjectId, name });
      if (!res.ok) return setError(res.fieldErrors?.name ?? res.error);
      toast.success(`“${name.trim()}” added`);
      setName("");
      router.refresh();
    });
  }

  return (
    <div>
      {topics.length ? (
        <ul className="divide-y divide-hair">
          {topics.map((t, i) => (
            <TopicRow key={t.id} topic={t} first={i === 0} last={i === topics.length - 1} archived={archived} />
          ))}
        </ul>
      ) : (
        <p className="pb-3 text-[13.5px] text-muted">No topics yet. Add the chapters or units you need to cover — progress for the subject is the average of its topics.</p>
      )}
      {!archived ? (
        <form onSubmit={add} className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="new-topic" className="sr-only">
              New topic name
            </label>
            <input
              id="new-topic"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add a topic, e.g. Transactions"
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "new-topic-error" : undefined}
              className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3.5 py-2.5 text-[14.5px] placeholder:text-faint"
            />
            <Button type="submit" icon="plus" pending={pending} variant="secondary">
              Add
            </Button>
          </div>
          {error ? (
            <p id="new-topic-error" className="text-[12.5px] text-clay">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
