import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Card, Label, Pill, ProgressBar } from "@/components/ui/card";
import { formatLocalDate } from "@/domain/dates";
import type { PrimaryGoalSummary } from "@/server/services/goals";

const PACE = { ahead: { tone: "moss", label: "Ahead" }, on_pace: { tone: "moss", label: "On pace" }, behind: { tone: "clay", label: "Behind" } } as const;

export function GoalCard({ goal }: { goal: PrimaryGoalSummary | null }) {
  if (!goal) {
    return (
      <Card>
        <Label>Main goal</Label>
        <p className="mt-1 font-serif text-[24px] leading-tight">Connect today to something bigger</p>
        <p className="mt-1 text-[13px] text-muted">Set a goal with a target date and we’ll show whether you’re on pace.</p>
        <Link href="/goals" className={buttonClass("secondary", "sm", "mt-3")}>
          Set a goal
        </Link>
      </Card>
    );
  }
  const pace = goal.status ? PACE[goal.status] : null;
  const pct = Math.round(goal.progress * 100);
  return (
    <Card>
      <Label>Main goal</Label>
      <Link href={`/goals/${goal.id}`} className="mt-1 block font-serif text-[28px] leading-[1.05] hover:underline">
        {goal.title}
      </Link>
      <div className="mt-2 flex items-end gap-3">
        <p className="font-serif text-[48px] leading-none">{pct}%</p>
        {pace ? (
          <Pill tone={pace.tone} className="mb-1.5 ml-auto">
            {pace.label}
          </Pill>
        ) : null}
      </div>
      <ProgressBar value={goal.progress} label={`${goal.title} progress`} className="mt-3" />
      <p className="mt-2 text-[12.5px] leading-[17px] text-muted">
        {goal.daysLeft != null ? `${goal.daysLeft} days left` : "No target date"}
        {goal.expected != null ? ` · plan says ${Math.round(goal.expected * 100)}% by today` : ""}
        {goal.estFinish ? ` · est. finish ${formatLocalDate(goal.estFinish, "d MMM yyyy")}` : ""}
      </p>
    </Card>
  );
}
