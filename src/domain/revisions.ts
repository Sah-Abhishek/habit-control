/** Spaced-revision scheduling. Pure; unit tested. */
import { addLocalDays, diffLocalDays, type LocalDate } from "./dates";

export const DEFAULT_REVISION_DAYS = [1, 3, 7, 21, 45] as const;

export type PlannedRevision = { step: number; dueDate: LocalDate };

/**
 * Revision dates measured from the day the topic was completed. Invalid,
 * duplicate or non-positive intervals are dropped and the rest sorted, so a bad
 * setting can never create a revision in the past or two on the same step.
 */
export function scheduleRevisions(completedOn: LocalDate, intervals: readonly number[]): PlannedRevision[] {
  const clean = [...new Set(intervals.filter((d) => Number.isInteger(d) && d > 0))].sort((a, b) => a - b);
  return clean.map((days, i) => ({ step: i + 1, dueDate: addLocalDays(completedOn, days) }));
}

/** Days overdue (0 when due today, negative when in the future). */
export function overdueDays(dueDate: LocalDate, today: LocalDate): number {
  return diffLocalDays(today, dueDate);
}

export type RevisionState = "done" | "skipped" | "due" | "overdue" | "upcoming";

export function revisionState(r: { dueDate: LocalDate; completedAt: Date | null; skippedAt: Date | null }, today: LocalDate): RevisionState {
  if (r.completedAt) return "done";
  if (r.skippedAt) return "skipped";
  const o = overdueDays(r.dueDate, today);
  if (o > 0) return "overdue";
  if (o === 0) return "due";
  return "upcoming";
}
