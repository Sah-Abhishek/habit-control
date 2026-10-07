"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { diffLocalDays, formatLocalDate } from "@/domain/dates";
import { cn } from "@/lib/cn";
import { createTaskAction, deleteTaskAction, toggleTaskAction } from "@/server/actions/tasks";
import type { TaskPickerOptions, TaskRowData } from "@/server/services/tasks";
import { TaskFormDialog, type TaskFormValues } from "./task-form";

export type { TaskRowData };

const PRIORITY: Record<TaskRowData["priority"], { tone: "clay" | "ochre" | "dusk" | "neutral"; label: string }> = {
  critical: { tone: "clay", label: "Critical" },
  high: { tone: "ochre", label: "High" },
  medium: { tone: "dusk", label: "Medium" },
  low: { tone: "neutral", label: "Low" },
};

function dueLabel(due: string | null, today: string): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const d = diffLocalDays(due, today);
  if (d === 0) return { text: "today", overdue: false };
  if (d === 1) return { text: "tomorrow", overdue: false };
  if (d < 0) return { text: d === -1 ? "overdue · yesterday" : `overdue · ${formatLocalDate(due, "d MMM")}`, overdue: true };
  return { text: formatLocalDate(due, d < 7 ? "EEE" : "d MMM"), overdue: false };
}

function toForm(t: TaskRowData): Partial<TaskFormValues> {
  return {
    title: t.title,
    notes: t.notes ?? "",
    dueDate: t.dueDate ?? "",
    priority: t.priority,
    goalId: t.goalId ?? "",
    subjectId: t.subjectId ?? "",
    topicId: t.topicId ?? "",
    estimateMinutes: t.estimateMinutes ? String(t.estimateMinutes) : "",
  };
}

function TaskRow({ task, today, options, onToggle }: { task: TaskRowData; today: string; options?: TaskPickerOptions; onToggle: (t: TaskRowData) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, startDelete] = useTransition();
  const due = dueLabel(task.dueDate, today);
  const context = [task.goalTitle, task.subjectName, task.topicName].filter(Boolean).join(" · ");
  const p = PRIORITY[task.priority];

  function remove() {
    startDelete(async () => {
      const res = await deleteTaskAction({ id: task.id });
      if (!res.ok) return toast.error(res.error);
      const snapshot = res.data;
      toast.success(`“${task.title}” deleted`, async () => {
        const undo = await createTaskAction(snapshot);
        if (!undo.ok) toast.error(undo.error);
        router.refresh();
      });
      router.refresh();
    });
  }

  return (
    <li className={cn("group flex items-center gap-3 py-2.5", deleting && "opacity-50")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.completed}
        aria-label={`${task.title}: ${task.completed ? "done" : "not done"}`}
        onClick={() => onToggle(task)}
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-[7px] transition-colors",
          task.completed ? "bg-moss text-moss-on" : "border-[1.5px] border-line hover:border-moss",
        )}
      >
        {task.completed ? <Icon name="check" size={14} strokeWidth={2.4} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[14px] font-medium", task.completed && "text-faint line-through decoration-faint/60")}>{task.title}</p>
        {context || due ? (
          <p className="truncate text-[12px] text-faint">
            {due ? <span className={cn(due.overdue && !task.completed && "font-medium text-clay")}>{due.text}</span> : null}
            {due && context ? " · " : null}
            {context}
          </p>
        ) : null}
      </div>
      {!task.completed ? <Pill tone={p.tone}>{p.label}</Pill> : null}
      {task.estimateMinutes ? <span className="w-12 text-right font-mono text-[12px] text-muted">{task.estimateMinutes}m</span> : null}
      {options ? (
        <span className="flex opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <button type="button" aria-label={`Edit ${task.title}`} onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink">
            <Icon name="edit" size={15} />
          </button>
          <button type="button" aria-label={`Delete ${task.title}`} onClick={remove} disabled={deleting} className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-clay">
            <Icon name="trash" size={15} />
          </button>
        </span>
      ) : null}
      {options && editing ? <TaskFormDialog open={editing} onClose={() => setEditing(false)} taskId={task.id} initial={toForm(task)} options={options} /> : null}
    </li>
  );
}

/**
 * Task rows with optimistic completion. Ticking shows a toast with Undo; failures
 * roll back and explain. Pass `options` to enable edit/delete.
 */
export function TaskList({ tasks, today, options, emptyText }: { tasks: TaskRowData[]; today: string; options?: TaskPickerOptions; emptyText?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state: TaskRowData[], change: { id: string; done: boolean }) =>
    state.map((t) => (t.id === change.id ? { ...t, completed: change.done } : t)),
  );

  function toggle(task: TaskRowData) {
    const done = !task.completed;
    startTransition(async () => {
      setOptimistic({ id: task.id, done });
      const res = await toggleTaskAction({ id: task.id, done });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(done ? `“${task.title}” done` : `“${task.title}” reopened`, async () => {
        const undo = await toggleTaskAction({ id: task.id, done: !done });
        if (!undo.ok) toast.error(undo.error);
        router.refresh();
      });
      router.refresh();
    });
  }

  if (!optimistic.length) return <p className="py-2 text-[13.5px] text-muted">{emptyText ?? "Nothing here."}</p>;
  return (
    <ul className="divide-y divide-hair">
      {optimistic.map((t) => (
        <TaskRow key={t.id} task={t} today={today} options={options} onToggle={toggle} />
      ))}
    </ul>
  );
}

export function AddTaskButton({
  options,
  defaults,
  label = "Add task",
  variant = "ghost",
  size = "sm",
}: {
  options: TaskPickerOptions;
  defaults?: Partial<TaskFormValues>;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon="plus" variant={variant} size={size} onClick={() => setOpen(true)} className={variant === "ghost" ? "text-moss" : undefined}>
        {label}
      </Button>
      {open ? <TaskFormDialog open={open} onClose={() => setOpen(false)} initial={defaults} options={options} /> : null}
    </>
  );
}
