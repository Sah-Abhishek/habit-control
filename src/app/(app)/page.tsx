import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { NewHabitButton } from "@/components/habits/habit-actions";
import { HabitRow } from "@/components/habits/habit-row";
import { RunningSessionBanner } from "@/components/study/running-session-banner";
import { toRunningSessionInfo } from "@/components/study/session-info";
import { AddTaskButton, TaskList } from "@/components/tasks/task-list";
import { CheckInCard } from "@/components/today/check-in-card";
import { DayTimeline } from "@/components/today/day-timeline";
import { FocusCard } from "@/components/today/focus-card";
import { GoalCard } from "@/components/today/goal-card";
import { LogAnything } from "@/components/today/log-anything";
import { RevisionsCard } from "@/components/today/revisions-card";
import { WeekBars } from "@/components/today/week-bars";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader, Label } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { formatLocalDate, hourOfDayIn } from "@/domain/dates";
import { requireUser } from "@/server/auth/session";
import { getPrimaryGoalSummary, listGoalOptions } from "@/server/services/goals";
import { habitSummaries } from "@/server/services/habits";
import { getToday } from "@/server/services/settings";
import { listTopicOptions, revisionsDue } from "@/server/services/study";
import { getTaskPickerOptions, listTasksForDay } from "@/server/services/tasks";
import { focusLabelFor, getTodayExtras, goalDayCount, toCheckInValues } from "@/server/services/today";

export const metadata: Metadata = { title: "Today" };

function greeting(hour: number): string {
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  if (hour < 22) return "Good evening.";
  return "Winding down.";
}

export default async function TodayPage() {
  const user = await requireUser();
  const { today, settings } = await getToday(user.id);
  const tz = settings.timezone;

  const [habits, tasks, taskOptions, goal, goalOptions, revisions, topics, extras] = await Promise.all([
    habitSummaries(user.id, today),
    listTasksForDay(user.id, today),
    getTaskPickerOptions(user.id),
    getPrimaryGoalSummary(user.id, today),
    listGoalOptions(user.id),
    revisionsDue(user.id, today),
    listTopicOptions(user.id),
    getTodayExtras(user.id, today, tz, settings.weekStartsOn),
  ]);
  const [dayCount, focusLabel] = await Promise.all([goal ? goalDayCount(user.id, goal.id, today) : null, focusLabelFor(user.id, extras.day)]);

  const day = extras.day;
  const focusTopic = day?.focusTopicId ? topics.find((t) => t.id === day.focusTopicId) : undefined;
  const nextMilestone = goal?.milestones.find((m) => !m.completed);
  const feeds = goal ? `${goal.title}${nextMilestone ? ` · ${nextMilestone.title} (${Math.round(nextMilestone.progress)}%)` : ""}` : null;

  const scheduled = habits.filter((h) => h.scheduledToday);
  const onTrack = scheduled.filter((h) => ["done", "clear", "within"].includes(h.todayState)).length;
  const checkIn = toCheckInValues(day, tz);
  const isNewUser = habits.length === 0 && !goal && topics.length === 0 && tasks.length === 0;

  const eyebrow = [formatLocalDate(today, "EEEE · d MMMM"), dayCount ? `Day ${dayCount.day} of ${dayCount.total}` : null].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={
          <>
            {greeting(hourOfDayIn(tz, new Date()))} <span className="hidden sm:inline">One thing first.</span>
          </>
        }
        actions={
          <>
            <Link href="/calendar?view=week" className={buttonClass("secondary", "md")}>
              <Icon name="calendar" size={18} /> This week
            </Link>
            <LogAnything
              focusTopicId={focusTopic?.id ?? null}
              taskOptions={taskOptions}
              habits={scheduled.map((s) => ({ habit: { id: s.habit.id, name: s.habit.name, kind: s.habit.kind, tracking: s.habit.tracking, target: s.habit.target, unit: s.habit.unit }, value: s.todayValue }))}
            />
          </>
        }
      />

      {extras.running ? (
        <div className="mb-5">
          <RunningSessionBanner session={toRunningSessionInfo(extras.running)} />
        </div>
      ) : null}

      {isNewUser ? (
        <Card className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Label className="text-ochre">Day 1</Label>
            <p className="mt-1 font-serif text-[26px] leading-tight">Start small: one habit, one goal.</p>
            <p className="mt-1 text-[13.5px] text-muted">Everything here fills in from what you log. Nothing is required — add what helps.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NewHabitButton goals={goalOptions} label="Create your first habit" />
            <Link href="/goals" className={buttonClass("secondary")}>
              Set a goal
            </Link>
            <Link href="/study" className={buttonClass("ghost")}>
              Add subjects
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-[1.15fr_1fr_300px]">
        <div className="flex flex-col gap-5">
          <FocusCard
            title={focusTopic ? `${focusTopic.subjectName} — ${focusTopic.name}` : (focusLabel ?? null)}
            detail={focusTopic ? (day?.focusText ?? null) : null}
            text={day?.focusText ?? null}
            topicId={focusTopic?.id ?? null}
            subjectId={focusTopic?.subjectId ?? null}
            feeds={feeds}
            topics={topics}
          />
          <Card>
            <CardHeader title="Today" />
            <DayTimeline blocks={extras.blocks} nowHour={extras.nowHour} studySeconds={extras.studySecondsToday} targetMinutes={settings.dailyStudyTargetMin} sleepMinutes={checkIn.sleepMinutes} />
          </Card>
          <Card>
            <CardHeader
              title="Tasks"
              meta={tasks.length ? `${tasks.filter((t) => t.completed).length} of ${tasks.length}` : undefined}
              action={<AddTaskButton options={taskOptions} defaults={{ dueDate: today }} />}
            />
            <TaskList tasks={tasks} today={today} options={taskOptions} emptyText="Nothing due today. Add a task, or enjoy the space." />
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Habits" meta={scheduled.length ? `${onTrack} of ${scheduled.length}` : undefined} action={<span className="text-[12px] text-faint">7-day trail</span>} />
            {habits.length === 0 ? (
              <EmptyState title="You haven’t created any habits yet." body="Start with one you already half-do." action={<NewHabitButton goals={goalOptions} label="Create your first habit" variant="secondary" />} />
            ) : scheduled.length === 0 ? (
              <p className="text-[13.5px] text-muted">No habits scheduled today. A rest day counts as part of the plan.</p>
            ) : (
              <ul className="divide-y divide-hair">
                {scheduled.map((s) => (
                  <HabitRow key={s.habit.id} summary={s} />
                ))}
              </ul>
            )}
          </Card>
          {revisions.length || topics.length ? (
            <RevisionsCard items={revisions.map((r) => ({ id: r.id, step: r.step, topicName: r.topicName, subjectName: r.subjectName, subjectId: r.subjectId, overdueDays: r.overdueDays }))} />
          ) : null}
          <div id="check-in" className="scroll-mt-24">
            <CheckInCard values={checkIn} />
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-2 lg:grid lg:grid-cols-2 xl:col-span-1 xl:flex">
          <GoalCard goal={goal} />
          <Card>
            <CardHeader title="This week" />
            <WeekBars weekStart={extras.weekStart} seconds={extras.weekSeconds} today={today} targetMinutes={settings.dailyStudyTargetMin} />
          </Card>
          {extras.observation ? (
            <section className="flex flex-col gap-2.5 rounded-[22px] bg-dusk-soft p-5">
              <span className="label-mono flex items-center gap-2 text-dusk">
                <Icon name="spark" size={16} /> Observation
              </span>
              <p className="font-serif text-[20px] leading-[25px]">{extras.observation.text}</p>
              <p className="text-[12px] text-muted">Based on {extras.observation.days} days · a pattern, not a cause.</p>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
