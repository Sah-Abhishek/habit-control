import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { BaselineGapChart } from "@/components/habits/baseline-chart";
import { HabitManage } from "@/components/habits/habit-actions";
import { HabitLogControl } from "@/components/habits/habit-log-control";
import { Trail } from "@/components/habits/trail";
import { Card, CardHeader, Label, Pill } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { addLocalDays, formatLocalDate } from "@/domain/dates";
import { formatNumber, formatPercent } from "@/domain/format";
import { dayState, thread, weeklyAverages } from "@/domain/habits";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/result";
import { listGoalOptions } from "@/server/services/goals";
import { getHabit, getLogMaps, summarise, toDef, type Habit } from "@/server/services/habits";
import { getToday } from "@/server/services/settings";

export const metadata: Metadata = { title: "Habit" };

async function load(userId: string, id: string): Promise<Habit> {
  if (!z.string().uuid().safeParse(id).success) notFound();
  try {
    return await getHabit(userId, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-[18px] bg-card p-4">
      <Label>{label}</Label>
      <p className={`mt-1 font-mono text-[20px] font-medium ${tone ?? ""}`}>{value}</p>
      {sub ? <p className="text-[12px] text-faint">{sub}</p> : null}
    </div>
  );
}

export default async function HabitDetailPage({ params }: PageProps<"/habits/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const habit = await load(user.id, id);
  const { today } = await getToday(user.id);
  const [maps, goalOptions] = await Promise.all([getLogMaps(user.id, [habit.id], addLocalDays(today, -400), today), listGoalOptions(user.id)]);
  const logs = maps.get(habit.id) ?? new Map();
  const s = summarise(habit, logs, today);
  const def = toDef(habit);
  const loggable = { id: habit.id, name: habit.name, kind: habit.kind, tracking: habit.tracking, target: habit.target, unit: habit.unit };
  const recent = Array.from({ length: 14 }, (_, i) => addLocalDays(today, -i)).filter((d) => d >= habit.startedOn);
  const r = s.reduction;

  return (
    <>
      <Link href="/habits" className="mb-4 inline-flex items-center gap-1 text-[14px] font-medium text-muted hover:text-ink">
        <Icon name="back" size={18} /> Habits
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            {habit.kind === "reduce" ? <Pill tone="clay">Reducing</Pill> : <Pill tone="moss">Building</Pill>}
            {habit.archivedAt ? <Pill>Archived</Pill> : null}
            {habit.isSensitive ? <Pill tone="dusk">Sensitive</Pill> : null}
          </span>
        }
        title={habit.name}
        actions={
          <HabitManage
            habitId={habit.id}
            name={habit.name}
            archived={!!habit.archivedAt}
            goals={goalOptions}
            initial={{ name: habit.name, kind: habit.kind, tracking: habit.tracking, target: habit.target, unit: habit.unit, scheduleDays: habit.scheduleDays, baseline: habit.baseline, isSensitive: habit.isSensitive, goalId: habit.goalId }}
          />
        }
      >
        <p className="mt-2 text-[14px] text-muted">
          Since {formatLocalDate(habit.startedOn, "d MMM yyyy")}
          {habit.kind === "reduce" ? ` · limit ${formatNumber(habit.target)} / day${habit.baseline != null ? ` · baseline ${formatNumber(habit.baseline)}` : ""}` : ""}
        </p>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          {r ? (
            <Card>
              <Label>7-day average</Label>
              <div className="mt-1 flex items-end gap-3">
                <p className="font-serif text-[64px] leading-none">{formatNumber(r.weekAvg)}</p>
                {r.weekChange != null ? (
                  <p className="pb-2">
                    <span className={`font-mono text-[16px] font-medium ${r.weekChange >= 0 ? "text-moss" : "text-clay"}`}>
                      {r.weekChange >= 0 ? "↓" : "↑"} {formatPercent(Math.abs(r.weekChange))}
                    </span>
                    <span className="block text-[12px] text-muted">from {formatNumber(r.prevWeekAvg)} the week before</span>
                  </p>
                ) : (
                  <p className="pb-2 text-[12.5px] text-muted">Comparison appears after two weeks.</p>
                )}
              </div>
              <div className="mt-4">
                <BaselineGapChart weeks={weeklyAverages(def, logs, today, 12)} baseline={habit.baseline} limit={habit.target} />
              </div>
              {r.avoidedVsBaseline != null ? (
                <p className="mt-2 text-[12.5px] text-muted">≈ {r.avoidedVsBaseline} fewer times than your baseline since you started. Days without a log count as zero.</p>
              ) : (
                <p className="mt-2 text-[12.5px] text-muted">Add a baseline (Edit) to see how much you’ve avoided. Days without a log count as zero.</p>
              )}
            </Card>
          ) : null}

          {r && r.todayValue > 0 ? (
            <p className="rounded-2xl bg-sunken p-4 text-[13.5px] leading-5">
              <span className="font-mono font-medium text-clay">{formatNumber(r.todayValue)}</span> logged today
              {r.todayValue <= habit.target ? " — inside your limit." : "."} One day doesn’t undo your trend; your progress stays exactly where it is.
            </p>
          ) : null}

          <Card>
            <CardHeader title="Last 90 days" action={<span className="text-[12px] text-faint">a gap is a missed day — the thread continues</span>} />
            <Trail ticks={thread(def, logs, today, 90)} kind={habit.kind} tickWidth={4} gap={2} className="h-5" />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
              <span>{formatLocalDate(addLocalDays(today, -89), "d MMM")}</span>
              <span>today</span>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent days" action={<span className="text-[12px] text-faint">fix a forgotten day</span>} />
            <ul className="divide-y divide-hair">
              {recent.map((d) => {
                const state = dayState(def, logs, d, today);
                return (
                  <li key={d} className="flex items-center gap-3 py-2.5">
                    <span className="w-28 font-mono text-[12.5px] text-muted">{d === today ? "Today" : formatLocalDate(d, "EEE d MMM")}</span>
                    <span className="flex-1 text-[12.5px] text-faint">{state === "off" ? "not scheduled" : ""}</span>
                    {state === "off" || habit.archivedAt ? (
                      <span className="font-mono text-[13px] text-muted">{formatNumber(logs.get(d) ?? 0)}</span>
                    ) : (
                      <HabitLogControl habit={loggable} value={logs.get(d) ?? 0} date={d} />
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="grid h-fit grid-cols-2 gap-3">
          {r ? (
            <>
              <Stat label="Clear days" value={`${r.clearDaysLast30} / 30`} sub="last 30 days" />
              <Stat label="Best clear run" value={`${r.longestClearRun} days`} />
              <Stat label="Monthly avg" value={formatNumber(r.monthAvg)} sub={r.prevMonthAvg != null ? `prev ${formatNumber(r.prevMonthAvg)}` : "first month"} />
              <Stat label="Since last" value={r.daysSinceLast == null ? "never" : r.daysSinceLast === 0 ? "today" : `${r.daysSinceLast} days`} />
            </>
          ) : null}
          <Stat label="7 days" value={formatPercent(s.c7.rate)} sub={`${s.c7.successes} of ${s.c7.scheduled}`} tone="text-moss" />
          <Stat label="30 days" value={formatPercent(s.c30.rate)} sub={`${s.c30.successes} of ${s.c30.scheduled}`} tone="text-moss" />
          <Stat label="90 days" value={formatPercent(s.c90.rate)} sub={`${s.c90.successes} of ${s.c90.scheduled}`} />
          <Stat label="Streak" value={`${s.streak}`} sub={`best ${s.best}`} />
        </div>
      </div>
    </>
  );
}
