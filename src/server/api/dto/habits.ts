import "server-only";
import type { ThreadTick } from "@/domain/habits";
import type { Habit, HabitSummary } from "@/server/services/habits";

export function habitDto(h: Habit) {
  return {
    id: h.id,
    name: h.name,
    kind: h.kind,
    tracking: h.tracking,
    target: h.target,
    unit: h.unit,
    scheduleDays: h.scheduleDays,
    baseline: h.baseline,
    isSensitive: h.isSensitive,
    goalId: h.goalId,
    startedOn: h.startedOn,
    archived: h.archivedAt != null,
  };
}

const tick = (t: ThreadTick) => ({ date: t.date, state: t.state, value: t.value });

export function habitSummaryDto(s: HabitSummary) {
  return {
    ...habitDto(s.habit),
    today: { value: s.todayValue, state: s.todayState, scheduled: s.scheduledToday },
    consistency: { d7: s.c7, d30: s.c30, d90: s.c90 },
    streak: { current: s.streak, best: s.best },
    trail7: s.trail7.map(tick),
    reduction: s.reduction,
  };
}

export { tick as tickDto };
