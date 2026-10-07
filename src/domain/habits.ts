/**
 * Pure habit statistics. No I/O — everything here is unit tested.
 *
 * Conventions
 * - "build" habits succeed on a scheduled day when value >= target.
 * - "reduce" habits succeed when value <= target (the daily limit). A day with no
 *   log counts as 0 for reduce habits: you log when it happens, silence means clear.
 * - Today is "pending" until it succeeds, so an unfinished today never breaks a
 *   streak or lowers consistency.
 * - A miss never erases history: best streak, totals and trends are kept.
 */
import { addLocalDays, dayOfWeek, diffLocalDays, eachLocalDay, type LocalDate } from "./dates";

export type HabitKind = "build" | "reduce";

export type HabitDef = {
  kind: HabitKind;
  target: number;
  /** 0 = Sunday … 6 = Saturday */
  scheduleDays: number[];
  startedOn: LocalDate;
  baseline?: number | null;
};

/** value per local date */
export type HabitLogMap = ReadonlyMap<LocalDate, number>;

export type DayState =
  | "done" // build: met target
  | "partial" // build: some progress
  | "missed" // build: scheduled, nothing logged, day is over
  | "clear" // reduce: zero
  | "within" // reduce: above zero, within limit
  | "over" // reduce: above limit
  | "pending" // today, not yet successful
  | "off" // not scheduled / before start
  | "future";

export function isScheduled(habit: HabitDef, date: LocalDate): boolean {
  return diffLocalDays(date, habit.startedOn) >= 0 && habit.scheduleDays.includes(dayOfWeek(date));
}

export function valueOn(habit: HabitDef, logs: HabitLogMap, date: LocalDate): number {
  return logs.get(date) ?? 0;
}

export function isSuccess(habit: HabitDef, value: number): boolean {
  return habit.kind === "build" ? value >= habit.target && value > 0 : value <= habit.target;
}

export function dayState(habit: HabitDef, logs: HabitLogMap, date: LocalDate, today: LocalDate): DayState {
  if (diffLocalDays(date, today) > 0) return "future";
  if (!isScheduled(habit, date)) return "off";
  const value = valueOn(habit, logs, date);
  const isToday = date === today;
  if (habit.kind === "build") {
    if (isSuccess(habit, value)) return "done";
    if (isToday) return value > 0 ? "partial" : "pending";
    return value > 0 ? "partial" : "missed";
  }
  if (value === 0) return isToday ? "pending" : "clear";
  if (value <= habit.target) return isToday ? "pending" : "within";
  return "over";
}

function succeeded(state: DayState): boolean {
  return state === "done" || state === "clear" || state === "within";
}

/** Scheduled days in the window that count toward consistency (pending today excluded). */
function countedDays(habit: HabitDef, logs: HabitLogMap, start: LocalDate, end: LocalDate, today: LocalDate) {
  let scheduled = 0;
  let successes = 0;
  for (const d of eachLocalDay(start, end)) {
    const s = dayState(habit, logs, d, today);
    if (s === "off" || s === "future" || s === "pending") continue;
    scheduled++;
    if (succeeded(s)) successes++;
  }
  return { scheduled, successes };
}

export type Consistency = { successes: number; scheduled: number; rate: number | null };

/** Share of scheduled days that succeeded over the last `days` days ending today. */
export function consistency(habit: HabitDef, logs: HabitLogMap, today: LocalDate, days: number): Consistency {
  const start = addLocalDays(today, -(days - 1));
  const { scheduled, successes } = countedDays(habit, logs, start, today, today);
  return { successes, scheduled, rate: scheduled === 0 ? null : successes / scheduled };
}

/**
 * Consecutive successful scheduled days ending today (or yesterday if today is
 * still pending). Unscheduled days are skipped, not counted as breaks.
 */
export function currentStreak(habit: HabitDef, logs: HabitLogMap, today: LocalDate): number {
  let streak = 0;
  for (let d = today; diffLocalDays(d, habit.startedOn) >= 0; d = addLocalDays(d, -1)) {
    const s = dayState(habit, logs, d, today);
    if (s === "off" || s === "pending") continue;
    if (!succeeded(s)) break;
    streak++;
  }
  return streak;
}

export function bestStreak(habit: HabitDef, logs: HabitLogMap, today: LocalDate): number {
  let best = 0;
  let run = 0;
  for (const d of eachLocalDay(habit.startedOn, today)) {
    const s = dayState(habit, logs, d, today);
    if (s === "off" || s === "pending") continue;
    if (succeeded(s)) {
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

export type ThreadTick = { date: LocalDate; state: DayState; value: number };

/** The last `days` days as ticks for the "thread" visual, oldest first. */
export function thread(habit: HabitDef, logs: HabitLogMap, today: LocalDate, days: number): ThreadTick[] {
  return eachLocalDay(addLocalDays(today, -(days - 1)), today).map((date) => ({
    date,
    state: dayState(habit, logs, date, today),
    value: valueOn(habit, logs, date),
  }));
}

function average(habit: HabitDef, logs: HabitLogMap, start: LocalDate, end: LocalDate): number | null {
  const effectiveStart = diffLocalDays(start, habit.startedOn) < 0 ? habit.startedOn : start;
  const days = eachLocalDay(effectiveStart, end);
  if (days.length === 0) return null;
  return days.reduce((sum, d) => sum + valueOn(habit, logs, d), 0) / days.length;
}

export type ReductionStats = {
  weekAvg: number | null;
  prevWeekAvg: number | null;
  monthAvg: number | null;
  prevMonthAvg: number | null;
  /** Positive = improvement (lower than the previous week). */
  weekChange: number | null;
  /** Days since the most recent day with an occurrence; null if none ever logged. */
  daysSinceLast: number | null;
  /** Longest run of consecutive zero days. */
  longestClearRun: number;
  clearDaysLast30: number;
  /** Occurrences avoided compared with the baseline since starting. */
  avoidedVsBaseline: number | null;
  todayValue: number;
};

/** Stats for reduce habits. Weeks are the 7 days ending yesterday (today is incomplete). */
export function reductionStats(habit: HabitDef, logs: HabitLogMap, today: LocalDate): ReductionStats {
  const yesterday = addLocalDays(today, -1);
  const weekAvg = average(habit, logs, addLocalDays(yesterday, -6), yesterday);
  const prevWeekEnd = addLocalDays(yesterday, -7);
  const prevWeekAvg = diffLocalDays(prevWeekEnd, habit.startedOn) >= 0 ? average(habit, logs, addLocalDays(prevWeekEnd, -6), prevWeekEnd) : null;
  const monthAvg = average(habit, logs, addLocalDays(yesterday, -29), yesterday);
  const prevMonthEnd = addLocalDays(yesterday, -30);
  const prevMonthAvg = diffLocalDays(prevMonthEnd, habit.startedOn) >= 0 ? average(habit, logs, addLocalDays(prevMonthEnd, -29), prevMonthEnd) : null;

  let daysSinceLast: number | null = null;
  let longestClearRun = 0;
  let run = 0;
  let avoided = 0;
  const history = diffLocalDays(yesterday, habit.startedOn) >= 0 ? eachLocalDay(habit.startedOn, yesterday) : [];
  for (const d of history) {
    const v = valueOn(habit, logs, d);
    if (v === 0) {
      run++;
      longestClearRun = Math.max(longestClearRun, run);
    } else run = 0;
    if (habit.baseline != null) avoided += Math.max(0, habit.baseline - v);
  }
  const todayValue = valueOn(habit, logs, today);
  for (let d = today, i = 0; diffLocalDays(d, habit.startedOn) >= 0; d = addLocalDays(d, -1), i++) {
    if (valueOn(habit, logs, d) > 0) {
      daysSinceLast = i;
      break;
    }
  }
  let clearDaysLast30 = 0;
  for (const d of eachLocalDay(addLocalDays(yesterday, -29), yesterday)) {
    if (diffLocalDays(d, habit.startedOn) >= 0 && valueOn(habit, logs, d) === 0) clearDaysLast30++;
  }

  return {
    weekAvg,
    prevWeekAvg,
    monthAvg,
    prevMonthAvg,
    weekChange: weekAvg != null && prevWeekAvg != null && prevWeekAvg > 0 ? (prevWeekAvg - weekAvg) / prevWeekAvg : null,
    daysSinceLast,
    longestClearRun,
    clearDaysLast30,
    avoidedVsBaseline: habit.baseline != null ? Math.round(avoided) : null,
    todayValue,
  };
}

/** Weekly averages (oldest first) for the baseline-gap chart. */
export function weeklyAverages(habit: HabitDef, logs: HabitLogMap, today: LocalDate, weeks: number): Array<{ weekEnd: LocalDate; avg: number | null }> {
  const out: Array<{ weekEnd: LocalDate; avg: number | null }> = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = addLocalDays(today, -7 * w);
    const start = addLocalDays(end, -6);
    out.push({ weekEnd: end, avg: diffLocalDays(end, habit.startedOn) >= 0 ? average(habit, logs, start, end) : null });
  }
  return out;
}
