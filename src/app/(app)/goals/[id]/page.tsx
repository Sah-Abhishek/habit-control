import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { GoalManage } from "@/components/goals/goal-actions";
import { MilestoneRoute } from "@/components/goals/milestone-route";
import { PaceBar, PacePill } from "@/components/goals/pace";
import { AddTaskButton, TaskList } from "@/components/tasks/task-list";
import { Card, CardHeader, Label, Pill } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { formatLocalDate } from "@/domain/dates";
import { formatPercent } from "@/domain/format";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/result";
import { getGoalDetail, type GoalDetail } from "@/server/services/goals";
import { getToday } from "@/server/services/settings";
import { getTaskPickerOptions, listTasksForGoal } from "@/server/services/tasks";

export const metadata: Metadata = { title: "Goal" };

async function load(userId: string, id: string, today: string): Promise<GoalDetail> {
  if (!z.string().uuid().safeParse(id).success) notFound();
  try {
    return await getGoalDetail(userId, id, today);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}

function perWeek(v: number | null) {
  return v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}% / wk`;
}

export default async function GoalDetailPage({ params }: PageProps<"/goals/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const { today } = await getToday(user.id);
  const detail = await load(user.id, id, today);
  const [goalTasks, options] = await Promise.all([listTasksForGoal(user.id, id), getTaskPickerOptions(user.id)]);
  const { goal, metrics: m } = detail;
  const active = goal.status === "active";

  return (
    <>
      <Link href="/goals" className="mb-4 inline-flex items-center gap-1 text-[14px] font-medium text-muted hover:text-ink">
        <Icon name="back" size={18} /> Goals
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {goal.isPrimary ? <span className="text-ochre">Main goal</span> : "Goal"}
            {goal.status !== "active" ? <Pill>{goal.status[0].toUpperCase() + goal.status.slice(1)}</Pill> : null}
          </span>
        }
        title={goal.title}
        actions={
          <GoalManage
            goalId={goal.id}
            title={goal.title}
            status={goal.status}
            isPrimary={goal.isPrimary}
            today={today}
            initial={{ title: goal.title, description: goal.description ?? "", startDate: goal.startDate, targetDate: goal.targetDate ?? "", isPrimary: goal.isPrimary }}
          />
        }
      >
        <p className="mt-2 text-[14px] text-muted">
          Started {formatLocalDate(goal.startDate, "d MMM yyyy")}
          {goal.targetDate ? ` · target ${formatLocalDate(goal.targetDate, "d MMM yyyy")}` : " · no target date"}
          {m.daysLeft != null ? (m.daysLeft >= 0 ? ` · ${m.daysLeft} days left` : ` · ${-m.daysLeft} days past target`) : ""}
        </p>
        {goal.description ? <p className="mt-2 max-w-2xl text-[14px] leading-6 whitespace-pre-line">{goal.description}</p> : null}
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card>
            <div className="flex items-end gap-3">
              <p className="font-serif text-[64px] leading-none">{formatPercent(m.progress)}</p>
              <div className="ml-auto flex flex-col items-end gap-1 pb-1">
                {active ? <PacePill status={m.status} /> : null}
                {m.expected != null && active ? <span className="text-[12px] text-muted">plan says {formatPercent(m.expected)} by today</span> : null}
              </div>
            </div>
            <PaceBar progress={m.progress} expected={active ? m.expected : null} />
            <dl className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <dt className="label-mono">Velocity</dt>
                <dd className="font-mono text-[15px] font-medium">{perWeek(m.velocity)}</dd>
              </div>
              <div>
                <dt className="label-mono">Needed</dt>
                <dd className="font-mono text-[15px] font-medium">{perWeek(m.needed)}</dd>
              </div>
              <div>
                <dt className="label-mono">Est. finish</dt>
                <dd className="font-mono text-[15px] font-medium text-moss">{m.estFinish ? formatLocalDate(m.estFinish, "d MMM yy") : "—"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-4 text-faint">
              Progress is the average of your milestones. Estimates assume your average pace since the start continues — a rough guide, not a promise.
            </p>
          </Card>

          <Card>
            <CardHeader title="The route" action={<span className="font-mono text-[12px] text-faint">{detail.milestones.length} milestones</span>} />
            <MilestoneRoute
              goalId={goal.id}
              milestones={detail.milestones.map((x) => ({ id: x.id, title: x.title, targetDate: x.targetDate, progress: x.progress, completed: !!x.completedAt }))}
            />
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title="Tasks"
              meta={goalTasks.length ? `${goalTasks.filter((t) => t.completed).length} of ${goalTasks.length}` : undefined}
              action={<AddTaskButton options={options} defaults={{ goalId: goal.id }} />}
            />
            <TaskList tasks={goalTasks} today={today} options={options} emptyText="No tasks linked to this goal yet." />
          </Card>

          <Card>
            <CardHeader title="Study areas" />
            {detail.subjects.length ? (
              <ul className="divide-y divide-hair">
                {detail.subjects.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <Link href={`/study/${s.id}`} className="min-w-0 flex-1 truncate text-[14px] font-medium hover:underline">
                      {s.name}
                    </Link>
                    <span className="text-[12px] text-faint">{s.topicCount} topics</span>
                    <span className="w-12 text-right font-mono text-[13px]">{s.progress == null ? "—" : `${Math.round(s.progress)}%`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted">
                No subjects linked. Link one from{" "}
                <Link href="/study" className="font-semibold text-moss hover:underline">
                  Study
                </Link>
                .
              </p>
            )}
          </Card>

          <Card>
            <Label>Linked habits</Label>
            {detail.habits.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {detail.habits.map((h) => (
                  <li key={h.id}>
                    <Link href={`/habits/${h.id}`} className={`inline-block rounded-full px-3 py-1.5 text-[12.5px] font-medium ${h.kind === "reduce" ? "bg-clay-soft text-clay" : "bg-moss-soft text-moss"}`}>
                      {h.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13.5px] text-muted">None yet. When you create or edit a habit, choose this goal under “Supports a goal”.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
