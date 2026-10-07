import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { EffortWeight } from "@/components/insights/effort-weight";
import { FocusHours } from "@/components/insights/focus-hours";
import { HabitThreads } from "@/components/insights/habit-threads";
import { Kpi } from "@/components/insights/kpi";
import { ObservationsCard } from "@/components/insights/observations-card";
import { RangeSwitch } from "@/components/insights/range-switch";
import { WeeklyHoursChart, weeklySubtitle } from "@/components/insights/weekly-hours-chart";
import { WellbeingChart } from "@/components/insights/wellbeing-chart";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/states";
import { formatLocalDate } from "@/domain/dates";
import { formatDuration, formatNumber, formatPercent } from "@/domain/format";
import { parseRange } from "@/domain/insights";
import { requireUser } from "@/server/auth/session";
import { getInsights } from "@/server/services/insights";

export const metadata: Metadata = { title: "Insights" };

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export default async function InsightsPage({ searchParams }: PageProps<"/insights">) {
  const user = await requireUser();
  const range = parseRange((await searchParams).range);
  const data = await getInsights(user.id, range);
  const k = data.kpis;
  const target = data.targetSecondsPerDay;
  const hasStudy = data.weeks.some((w) => w.seconds > 0);
  const hasWellbeing = data.wellbeing.some((p) => p.sleepHours != null || p.mood != null || p.energy != null);
  const rangeLabel = { "7d": "7 days", "30d": "30 days", "90d": "90 days", "1y": "12 months" }[range];

  return (
    <>
      <PageHeader
        eyebrow={`Insights · ${formatLocalDate(data.start, "d MMM")} – ${formatLocalDate(data.today, "d MMM")}`}
        title="What’s working, and what isn’t."
        actions={
          <>
            <RangeSwitch value={range} />
            <Link href="/settings#export" className={buttonClass("secondary", "sm")}>
              <Icon name="download" size={16} /> Export
            </Link>
          </>
        }
      />

      <section aria-label={`Key numbers for the last ${rangeLabel}`} className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Study"
          value={formatDuration(k.totalSeconds)}
          sub={k.totalChange == null ? "no earlier period yet" : `${k.totalChange >= 0 ? "↑" : "↓"} ${formatPercent(Math.abs(k.totalChange))} vs prev ${rangeLabel}`}
          tone={k.totalChange == null ? "muted" : k.totalChange >= 0 ? "moss" : "clay"}
        />
        <Kpi label="Avg / day" value={formatDuration(k.avgSecondsPerDay)} sub={target ? `target ${formatDuration(target)}` : "no daily target"} tone={target && k.avgSecondsPerDay >= target ? "moss" : "ochre"} />
        <Kpi label="Consistency" value={formatPercent(k.consistency)} sub={`${k.studyDays} of ${k.days} days`} />
        <Kpi label="Focus" value={k.avgFocus == null ? "—" : `${formatNumber(k.avgFocus)} / 5`} sub={k.focusSessions ? `${k.focusSessions} rated sessions` : "rate sessions to see this"} tone="muted" />
        <Kpi label="Accuracy" value={formatPercent(k.accuracy)} sub={k.attempted ? `${k.correct} of ${k.attempted} questions` : "log questions in sessions"} tone="muted" />
        <Kpi label="Revisions done" value={data.revisions.due ? formatPercent(data.revisions.done / data.revisions.due) : "—"} sub={data.revisions.due ? `${data.revisions.done} of ${data.revisions.due} due` : "none due in range"} tone="muted" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader title="Study hours per week" action={hasStudy ? <span className="text-[12.5px] text-muted">{weeklySubtitle(data.weeks, (target * 7) / 3600)}</span> : null} />
            {hasStudy ? (
              <WeeklyHoursChart weeks={data.weeks} targetHoursPerWeek={(target * 7) / 3600} />
            ) : (
              <EmptyState title="No study sessions in the last 12 weeks." body="Start a session from Study or Today and your weekly hours will build up here." />
            )}
          </Card>

          <Card>
            <CardHeader title="Habit threads · 90 days" action={data.threads.length ? <span className="hidden text-[12.5px] text-muted sm:inline">a gap is a missed day — the thread continues</span> : null} />
            {data.threads.length ? (
              <HabitThreads threads={data.threads} />
            ) : (
              <EmptyState title="No habits yet." body="Add a habit and each day you log becomes a tick in its thread." action={<Link className={buttonClass("secondary", "sm")} href="/habits">Go to Habits</Link>} />
            )}
          </Card>

          <Card>
            <CardHeader title="Sleep, mood & energy" />
            {hasWellbeing ? (
              <WellbeingChart points={data.wellbeing} />
            ) : (
              <EmptyState title={`Nothing logged in the last ${rangeLabel}.`} body="Log sleep, mood and energy from Today’s check-in — each takes a tap, and all of it is optional." />
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader title="Effort vs exam weight" />
            {!data.effort.rows.length ? (
              <EmptyState title="No subjects yet." body="Add subjects in Study to compare where your time goes." />
            ) : !data.effort.hasWeights ? (
              <EmptyState title="Add weights to compare." body="Give subjects a weight (their share of marks) in Study, and we’ll show which ones get less time than they deserve." />
            ) : (
              <>
                <p className="-mt-1 mb-3 text-[12px] text-muted">Bars: your share of study time · grey: share of marks. Red = under 60% of its weight.</p>
                <EffortWeight rows={data.effort.rows} />
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="When you focus best" />
            {data.hours.some((h) => h.sessions > 0) ? (
              <>
                <FocusHours cells={data.hours} />
                <p className="mt-3 text-[12.5px] text-muted">
                  {data.bestWindow
                    ? `${hh(data.bestWindow.from)}–${hh(data.bestWindow.to)} averages focus ${formatNumber(data.bestWindow.avg)}${data.bestWindow.otherAvg != null ? ` · other hours ${formatNumber(data.bestWindow.otherAvg)}` : ""}.`
                    : "Faint cells have fewer than 3 rated sessions — keep rating sessions to find your best hours."}
                </p>
              </>
            ) : (
              <EmptyState title="No sessions in this range." body="Rate your focus when you finish a session and your strongest hours will show here." />
            )}
          </Card>

          <ObservationsCard items={data.observations} windowDays={data.observationDays} />
        </div>
      </div>
    </>
  );
}
