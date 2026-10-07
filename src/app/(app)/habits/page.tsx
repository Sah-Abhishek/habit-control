import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { NewHabitButton } from "@/components/habits/habit-actions";
import { HabitRow } from "@/components/habits/habit-row";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { formatLocalDate } from "@/domain/dates";
import { requireUser } from "@/server/auth/session";
import { listGoalOptions } from "@/server/services/goals";
import { habitSummaries, listHabits } from "@/server/services/habits";
import { getToday } from "@/server/services/settings";

export const metadata: Metadata = { title: "Habits" };

export default async function HabitsPage() {
  const user = await requireUser();
  const { today } = await getToday(user.id);
  const [summaries, goalOptions, all] = await Promise.all([habitSummaries(user.id, today), listGoalOptions(user.id), listHabits(user.id, { includeArchived: true })]);
  const archived = all.filter((h) => h.archivedAt);
  const build = summaries.filter((s) => s.habit.kind === "build");
  const reduce = summaries.filter((s) => s.habit.kind === "reduce");
  const doneToday = summaries.filter((s) => s.scheduledToday && ["done", "clear", "within"].includes(s.todayState)).length;
  const scheduledToday = summaries.filter((s) => s.scheduledToday).length;

  return (
    <>
      <PageHeader eyebrow={formatLocalDate(today, "EEEE · d MMMM")} title="Habits" actions={<NewHabitButton goals={goalOptions} />}>
        {summaries.length ? <p className="mt-2 text-[14px] text-muted">{doneToday} of {scheduledToday} on track today. Tap to log — a missed day is a gap in the thread, not a reset.</p> : null}
      </PageHeader>

      {summaries.length === 0 ? (
        <EmptyState
          className="max-w-xl"
          title="You haven’t created any habits yet."
          body="Start with one or two you already half-do — consistency beats ambition. You can also track things you want to do less of."
          action={<NewHabitButton goals={goalOptions} label="Create your first habit" />}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Building" meta={`${build.length}`} />
            {build.length ? (
              <ul className="divide-y divide-hair">{build.map((s) => <HabitRow key={s.habit.id} summary={s} />)}</ul>
            ) : (
              <p className="text-[13.5px] text-muted">No habits to build yet.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Doing less of" meta={`${reduce.length}`} />
            {reduce.length ? (
              <ul className="divide-y divide-hair">{reduce.map((s) => <HabitRow key={s.habit.id} summary={s} />)}</ul>
            ) : (
              <p className="text-[13.5px] text-muted">Nothing here. Add a “do less of” habit to track it against your own baseline — lapses never wipe your progress.</p>
            )}
          </Card>
        </div>
      )}

      {archived.length ? (
        <section className="mt-8">
          <h2 className="label-mono mb-2">Archived · history kept</h2>
          <ul className="flex flex-wrap gap-2">
            {archived.map((h) => (
              <li key={h.id}>
                <Link href={`/habits/${h.id}`} className="inline-block rounded-full border border-line px-3 py-1.5 text-[13px] text-muted hover:text-ink">
                  {h.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
