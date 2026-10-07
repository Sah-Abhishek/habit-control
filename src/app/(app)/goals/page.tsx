import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { NewGoalButton } from "@/components/goals/goal-actions";
import { PaceBar, PacePill } from "@/components/goals/pace";
import { Card, Label, Pill } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { formatLocalDate } from "@/domain/dates";
import { formatPercent } from "@/domain/format";
import { requireUser } from "@/server/auth/session";
import { listGoalCards, type GoalCard } from "@/server/services/goals";
import { getToday } from "@/server/services/settings";

export const metadata: Metadata = { title: "Goals" };

function daysLeftText(n: number | null, targetDate: string | null): string {
  if (n == null || !targetDate) return "No target date";
  if (n < 0) return `Target passed ${formatLocalDate(targetDate, "d MMM yyyy")}`;
  if (n === 0) return "Due today";
  return `${n} day${n === 1 ? "" : "s"} left · ${formatLocalDate(targetDate, "d MMM yyyy")}`;
}

function GoalCardView({ card }: { card: GoalCard }) {
  const { goal, metrics } = card;
  return (
    <Link href={`/goals/${goal.id}`} className="block rounded-[22px] focus-visible:outline-2">
      <Card className="h-full transition-colors hover:bg-card/70">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {goal.isPrimary ? <Label className="text-ochre">Main goal</Label> : null}
          {goal.status !== "active" ? <Pill>{goal.status[0].toUpperCase() + goal.status.slice(1)}</Pill> : <PacePill status={metrics.status} />}
        </div>
        <div className="flex items-end gap-3">
          <h2 className="min-w-0 flex-1 font-serif text-[28px] leading-tight">{goal.title}</h2>
          <span className="font-mono text-[22px] font-medium">{formatPercent(metrics.progress)}</span>
        </div>
        <PaceBar progress={metrics.progress} expected={goal.status === "active" ? metrics.expected : null} />
        <p className="text-[12.5px] text-muted">
          {daysLeftText(metrics.daysLeft, goal.targetDate)}
          {card.milestoneCount ? ` · ${card.completedMilestones} of ${card.milestoneCount} milestones` : " · no milestones yet"}
        </p>
      </Card>
    </Link>
  );
}

export default async function GoalsPage() {
  const user = await requireUser();
  const { today } = await getToday(user.id);
  const cards = await listGoalCards(user.id, today);
  const open = cards.filter((c) => c.goal.status === "active" || c.goal.status === "paused");
  const done = cards.filter((c) => c.goal.status === "completed");
  const archived = cards.filter((c) => c.goal.status === "archived");

  return (
    <>
      <PageHeader eyebrow="Long-term" title="Goals" actions={<NewGoalButton today={today} isFirst={cards.length === 0} />}>
        {open.length ? <p className="mt-2 text-[14px] text-muted">The marker on each bar shows where steady work would put you today.</p> : null}
      </PageHeader>

      {cards.length === 0 ? (
        <EmptyState
          className="max-w-xl"
          title="You haven’t set a goal yet."
          body="Pick one long-term outcome — an exam, a skill, a project — and give it a target date. Daily tasks, study and habits can then ladder up to it."
          action={<NewGoalButton today={today} label="Create your first goal" isFirst />}
        />
      ) : (
        <>
          {open.length ? (
            <div className="grid gap-5 md:grid-cols-2">
              {open.map((c) => (
                <GoalCardView key={c.goal.id} card={c} />
              ))}
            </div>
          ) : (
            <EmptyState className="max-w-xl" title="No active goals." body="Your completed and archived goals are below. Start a new one when you’re ready." />
          )}
          {done.length ? (
            <section className="mt-8">
              <h2 className="label-mono mb-3">Completed</h2>
              <div className="grid gap-5 md:grid-cols-2">
                {done.map((c) => (
                  <GoalCardView key={c.goal.id} card={c} />
                ))}
              </div>
            </section>
          ) : null}
          {archived.length ? (
            <section className="mt-8">
              <h2 className="label-mono mb-2">Archived</h2>
              <ul className="flex flex-wrap gap-2">
                {archived.map((c) => (
                  <li key={c.goal.id}>
                    <Link href={`/goals/${c.goal.id}`} className="inline-block rounded-full border border-line px-3 py-1.5 text-[13px] text-muted hover:text-ink">
                      {c.goal.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
