/**
 * Pure goal maths. No I/O — unit tested.
 *
 * Assumptions (we don't store a history of progress changes):
 * - Goal progress is the plain average of its milestones' progress (0–100). With no
 *   milestones, progress is 0 — there is nothing to measure yet.
 * - "Expected" progress assumes steady work: the fraction of time elapsed between
 *   startDate and targetDate.
 * - Velocity and estimated finish extrapolate linearly from startDate to today. This
 *   is a rough guide, not a forecast, and is hidden until there is real progress.
 */
import { addLocalDays, diffLocalDays, type LocalDate } from "./dates";

export type PaceStatus = "ahead" | "on_pace" | "behind";

/** Points of tolerance (on a 0–100 scale) before we call a goal ahead/behind. */
export const PACE_TOLERANCE = 0.05;

export function goalProgress(milestones: ReadonlyArray<{ progress: number }>): number {
  if (milestones.length === 0) return 0;
  const sum = milestones.reduce((s, m) => s + Math.max(0, Math.min(100, m.progress)), 0);
  return sum / milestones.length / 100;
}

/** Fraction of the planned time that has passed, clamped to 0..1; null without a target date. */
export function expectedProgress(startDate: LocalDate, targetDate: LocalDate | null, today: LocalDate): number | null {
  if (!targetDate) return null;
  const total = diffLocalDays(targetDate, startDate);
  if (total <= 0) return diffLocalDays(today, targetDate) >= 0 ? 1 : 0;
  const elapsed = diffLocalDays(today, startDate);
  return Math.max(0, Math.min(1, elapsed / total));
}

export function paceStatus(progress: number, expected: number | null): PaceStatus | null {
  if (expected == null) return null;
  if (progress >= 1) return "ahead";
  if (progress - expected > PACE_TOLERANCE) return "ahead";
  if (expected - progress > PACE_TOLERANCE) return "behind";
  return "on_pace";
}

export function daysLeft(targetDate: LocalDate | null, today: LocalDate): number | null {
  if (!targetDate) return null;
  return diffLocalDays(targetDate, today);
}

/** Progress per 7 days, averaged since start. Null before any day has elapsed. */
export function velocityPerWeek(progress: number, startDate: LocalDate, today: LocalDate): number | null {
  const elapsed = diffLocalDays(today, startDate);
  if (elapsed <= 0) return null;
  return (progress / elapsed) * 7;
}

/** Progress per week still needed to finish by the target date. */
export function neededPerWeek(progress: number, targetDate: LocalDate | null, today: LocalDate): number | null {
  if (!targetDate) return null;
  const remainingDays = diffLocalDays(targetDate, today);
  if (remainingDays <= 0) return null;
  return (Math.max(0, 1 - progress) / remainingDays) * 7;
}

/** Linear extrapolation of the finish date. Null when nothing has been done yet. */
export function estimatedFinish(progress: number, startDate: LocalDate, today: LocalDate): LocalDate | null {
  if (progress >= 1) return today;
  const elapsed = diffLocalDays(today, startDate);
  if (progress <= 0 || elapsed <= 0) return null;
  const totalDays = Math.ceil(elapsed / progress);
  // Guard against absurd projections from tiny progress.
  if (totalDays > 365 * 50) return null;
  return addLocalDays(startDate, totalDays);
}
