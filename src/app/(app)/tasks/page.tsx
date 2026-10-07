import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { AddTaskButton, TaskList } from "@/components/tasks/task-list";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { diffLocalDays, formatLocalDate } from "@/domain/dates";
import { cn } from "@/lib/cn";
import { requireUser } from "@/server/auth/session";
import { getToday } from "@/server/services/settings";
import { countTasks, getTaskPickerOptions, listTasks, type TaskFilter, type TaskRowData } from "@/server/services/tasks";

export const metadata: Metadata = { title: "Tasks" };

const FILTERS: Array<{ value: TaskFilter; label: string; empty: string }> = [
  { value: "today", label: "Today & overdue", empty: "Nothing due today. Enjoy the space — or pull something forward from Upcoming." },
  { value: "upcoming", label: "Upcoming", empty: "No tasks with a future due date." },
  { value: "someday", label: "No date", empty: "Every open task has a due date." },
  { value: "completed", label: "Completed", empty: "Completed tasks will show up here." },
];

function groupRows(filter: TaskFilter, rows: TaskRowData[], today: string): Array<{ title: string; rows: TaskRowData[] }> {
  if (filter === "today") {
    const overdue = rows.filter((r) => !r.completed && r.dueDate && diffLocalDays(r.dueDate, today) < 0);
    const due = rows.filter((r) => !r.completed && !overdue.includes(r));
    const done = rows.filter((r) => r.completed);
    return [
      { title: "Overdue", rows: overdue },
      { title: "Today", rows: due },
      { title: "Done today", rows: done },
    ].filter((g) => g.rows.length);
  }
  if (filter === "upcoming") {
    const groups = new Map<string, TaskRowData[]>();
    for (const r of rows) {
      const key = r.dueDate ? formatLocalDate(r.dueDate, "EEEE · d MMM") : "No date";
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return [...groups].map(([title, rows]) => ({ title, rows }));
  }
  return [{ title: "", rows }];
}

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const user = await requireUser();
  const sp = await searchParams;
  const raw = typeof sp.filter === "string" ? sp.filter : "today";
  const filter: TaskFilter = FILTERS.some((f) => f.value === raw) ? (raw as TaskFilter) : "today";
  const { today } = await getToday(user.id);
  const [rows, options, total] = await Promise.all([listTasks(user.id, filter, today), getTaskPickerOptions(user.id), countTasks(user.id)]);
  const groups = groupRows(filter, rows, today);
  const meta = FILTERS.find((f) => f.value === filter)!;

  return (
    <>
      <PageHeader eyebrow={formatLocalDate(today, "EEEE · d MMMM")} title="Tasks" actions={<AddTaskButton options={options} variant="primary" size="md" label="New task" defaults={filter === "today" ? { dueDate: today } : undefined} />} />

      {total === 0 ? (
        <EmptyState
          className="max-w-xl"
          title="You haven’t added any tasks yet."
          body="Keep tasks small and concrete — “Solve PYQ set 3” beats “Study DBMS”. Link them to a goal or topic to see how today’s work adds up."
          action={<AddTaskButton options={options} variant="primary" size="md" label="Add your first task" defaults={{ dueDate: today }} />}
        />
      ) : (
        <>
          <nav aria-label="Task filters" className="mb-5 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={f.value === "today" ? "/tasks" : `/tasks?filter=${f.value}`}
                aria-current={f.value === filter ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13px] font-medium",
                  f.value === filter ? "bg-inverse text-inverse-ink" : "border border-line text-ink hover:bg-sunken",
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>
          {rows.length === 0 ? (
            <EmptyState className="max-w-xl" title={meta.empty} />
          ) : (
            <div className="flex max-w-3xl flex-col gap-5">
              {groups.map((g) => (
                <Card key={g.title || "all"}>
                  {g.title ? <h2 className={cn("label-mono mb-1", g.title === "Overdue" && "text-clay")}>{g.title}</h2> : null}
                  <TaskList tasks={g.rows} today={today} options={options} />
                </Card>
              ))}
              {filter === "completed" && rows.length >= 500 ? <p className="text-[12.5px] text-faint">Showing the 500 most recent.</p> : null}
            </div>
          )}
        </>
      )}
    </>
  );
}
