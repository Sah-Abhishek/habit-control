import "server-only";
import type { GoalCard, Milestone } from "@/server/services/goals";

export function goalCardDto(c: GoalCard) {
  const g = c.goal;
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    status: g.status,
    startDate: g.startDate,
    targetDate: g.targetDate,
    isPrimary: g.isPrimary,
    progress: c.metrics.progress,
    expected: c.metrics.expected,
    pace: c.metrics.status,
    daysLeft: c.metrics.daysLeft,
    estFinish: c.metrics.estFinish,
    milestoneCount: c.milestoneCount,
    completedMilestones: c.completedMilestones,
  };
}

export function milestoneDto(m: Milestone) {
  return { id: m.id, title: m.title, targetDate: m.targetDate, progress: m.progress, position: m.position, completed: m.completedAt != null };
}
