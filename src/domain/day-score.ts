/**
 * A single 0..1 "how full was this day" score for the calendar.
 *
 * Weights (renormalised over the parts that were actually tracked that day):
 * - study  0.5 — minutes studied vs the daily target, capped at 1
 * - habits 0.35 — share of scheduled habits that succeeded
 * - tasks  0.15 — share of the day's tasks that were completed
 *
 * A part only counts when it applies: study when a target is set (or any study
 * happened), habits when any were scheduled, tasks when any were due or done.
 * Returns null when nothing applies — the calendar shows that as "no data",
 * which is different from an empty day (0).
 */
export type DayScoreInput = {
  studyMinutes: number;
  studyTargetMinutes: number;
  habitsScheduled: number;
  habitsSucceeded: number;
  tasksDue: number;
  tasksCompleted: number;
};

export const DAY_SCORE_WEIGHTS = { study: 0.5, habits: 0.35, tasks: 0.15 } as const;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export function dayScore(input: DayScoreInput): number | null {
  const parts: Array<[weight: number, value: number]> = [];
  if (input.studyTargetMinutes > 0) parts.push([DAY_SCORE_WEIGHTS.study, clamp01(input.studyMinutes / input.studyTargetMinutes)]);
  else if (input.studyMinutes > 0) parts.push([DAY_SCORE_WEIGHTS.study, 1]);
  if (input.habitsScheduled > 0) parts.push([DAY_SCORE_WEIGHTS.habits, clamp01(input.habitsSucceeded / input.habitsScheduled)]);
  const taskTotal = Math.max(input.tasksDue, input.tasksCompleted);
  if (taskTotal > 0) parts.push([DAY_SCORE_WEIGHTS.tasks, clamp01(input.tasksCompleted / taskTotal)]);
  if (!parts.length) return null;
  const totalWeight = parts.reduce((s, [w]) => s + w, 0);
  return parts.reduce((s, [w, v]) => s + w * v, 0) / totalWeight;
}

/** Bucket for visual intensity and screen-reader text. */
export function scoreBand(score: number | null): "none" | "light" | "medium" | "full" {
  if (score == null) return "none";
  if (score < 0.34) return "light";
  if (score < 0.67) return "medium";
  return "full";
}

export type Observation = { text: string; days: number };

/**
 * Honest, minimal correlation: study on nights with 7h+ sleep vs less, over the
 * last 60 days. Only shown with ≥14 qualifying days and ≥5 in each group.
 */
export function sleepStudyObservation(rows: Array<{ sleepHours: number; studyMinutes: number }>): Observation | null {
  if (rows.length < 14) return null;
  const rested = rows.filter((r) => r.sleepHours >= 7);
  const short = rows.filter((r) => r.sleepHours < 7);
  if (rested.length < 5 || short.length < 5) return null;
  const avg = (xs: typeof rows) => xs.reduce((s, r) => s + r.studyMinutes, 0) / xs.length;
  const a = avg(rested);
  const b = avg(short);
  if (Math.max(a, b) === 0) return null;
  const diff = Math.abs(a - b) / Math.max(a, b);
  const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`);
  if (diff < 0.1) return { text: `You study about the same after short and full nights (${fmt(a)} vs ${fmt(b)}).`, days: rows.length };
  return {
    text: `After 7h+ sleep you study ${fmt(a)} on average, versus ${fmt(b)} after shorter nights.`,
    days: rows.length,
  };
}
