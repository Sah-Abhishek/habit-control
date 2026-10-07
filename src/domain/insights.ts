/**
 * Pure analytics for the Insights page. No I/O — unit tested.
 *
 * Observations are deliberately conservative: they need a minimum number of paired
 * days, both comparison groups must be reasonably sized, and the difference has to
 * be material. They describe patterns, never causes.
 */
import { addLocalDays, diffLocalDays, eachLocalDay, startOfWeek, type LocalDate } from "./dates";

export const RANGES = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 } as const;
export type RangeKey = keyof typeof RANGES;

export function parseRange(value: unknown): RangeKey {
  return typeof value === "string" && value in RANGES ? (value as RangeKey) : "30d";
}

/** Minimum paired days before any observation is shown. */
export const MIN_PAIRED_DAYS = 14;
/** Below this many paired days an observation is labelled an early signal. */
export const STRONG_PAIRED_DAYS = 30;
/** Each side of a comparison needs at least this many days. */
export const MIN_GROUP_DAYS = 5;
/** Relative difference between groups below which we stay quiet. */
export const MIN_RELATIVE_DIFF = 0.1;

export type SessionPoint = {
  localDate: LocalDate;
  durationSeconds: number;
  focus: number | null;
  questionsAttempted: number | null;
  questionsCorrect: number | null;
  /** Hour of day (0–23) the session started, in the user's timezone. */
  startHour: number;
  subjectId: string | null;
};

export function studySecondsByDay(sessions: SessionPoint[]): Map<LocalDate, number> {
  const out = new Map<LocalDate, number>();
  for (const s of sessions) out.set(s.localDate, (out.get(s.localDate) ?? 0) + Math.max(0, s.durationSeconds));
  return out;
}

function inRange(date: LocalDate, start: LocalDate, end: LocalDate) {
  return diffLocalDays(date, start) >= 0 && diffLocalDays(end, date) >= 0;
}

export type StudyKpis = {
  totalSeconds: number;
  prevTotalSeconds: number;
  /** Relative change vs the previous period of equal length; null when there's nothing to compare. */
  totalChange: number | null;
  avgSecondsPerDay: number;
  studyDays: number;
  days: number;
  consistency: number;
  avgFocus: number | null;
  focusSessions: number;
  accuracy: number | null;
  attempted: number;
  correct: number;
};

export function studyKpis(sessions: SessionPoint[], start: LocalDate, end: LocalDate): StudyKpis {
  const days = diffLocalDays(end, start) + 1;
  const prevEnd = addLocalDays(start, -1);
  const prevStart = addLocalDays(prevEnd, -(days - 1));
  let total = 0;
  let prevTotal = 0;
  let focusSum = 0;
  let focusN = 0;
  let attempted = 0;
  let correct = 0;
  const studyDates = new Set<LocalDate>();
  for (const s of sessions) {
    if (inRange(s.localDate, start, end)) {
      total += s.durationSeconds;
      if (s.durationSeconds > 0) studyDates.add(s.localDate);
      if (s.focus != null) {
        focusSum += s.focus;
        focusN++;
      }
      // Only count questions when both numbers are known, so accuracy can't exceed 100%.
      if (s.questionsAttempted != null && s.questionsCorrect != null && s.questionsAttempted > 0) {
        attempted += s.questionsAttempted;
        correct += Math.min(s.questionsCorrect, s.questionsAttempted);
      }
    } else if (inRange(s.localDate, prevStart, prevEnd)) {
      prevTotal += s.durationSeconds;
    }
  }
  return {
    totalSeconds: total,
    prevTotalSeconds: prevTotal,
    totalChange: prevTotal > 0 ? (total - prevTotal) / prevTotal : null,
    avgSecondsPerDay: days > 0 ? total / days : 0,
    studyDays: studyDates.size,
    days,
    consistency: days > 0 ? studyDates.size / days : 0,
    avgFocus: focusN ? focusSum / focusN : null,
    focusSessions: focusN,
    accuracy: attempted ? correct / attempted : null,
    attempted,
    correct,
  };
}

export type WeekBar = { weekStart: LocalDate; seconds: number; isCurrent: boolean; daysElapsed: number };

/** Study seconds per week (oldest first), the last bar being the current partial week. */
export function weeklyStudy(byDay: Map<LocalDate, number>, today: LocalDate, weeks: number, weekStartsOn: number): WeekBar[] {
  const current = startOfWeek(today, weekStartsOn);
  const out: WeekBar[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const ws = addLocalDays(current, -7 * w);
    const we = w === 0 ? today : addLocalDays(ws, 6);
    let seconds = 0;
    for (const d of eachLocalDay(ws, we)) seconds += byDay.get(d) ?? 0;
    out.push({ weekStart: ws, seconds, isCurrent: w === 0, daysElapsed: diffLocalDays(we, ws) + 1 });
  }
  return out;
}

export type HourCell = { hour: number; avgFocus: number | null; sessions: number };

export const MIN_SESSIONS_PER_HOUR = 3;

export function focusByHour(sessions: SessionPoint[]): HourCell[] {
  const sum = Array<number>(24).fill(0);
  const n = Array<number>(24).fill(0);
  const count = Array<number>(24).fill(0);
  for (const s of sessions) {
    const h = Math.min(23, Math.max(0, Math.floor(s.startHour)));
    count[h]++;
    if (s.focus != null) {
      sum[h] += s.focus;
      n[h]++;
    }
  }
  return sum.map((total, hour) => ({ hour, avgFocus: n[hour] ? total / n[hour] : null, sessions: count[hour] }));
}

/** Best contiguous 2–3 hour window by average focus among reliable hours, if any. */
export function bestFocusWindow(cells: HourCell[]): { from: number; to: number; avg: number; otherAvg: number | null } | null {
  const reliable = cells.filter((c) => c.sessions >= MIN_SESSIONS_PER_HOUR && c.avgFocus != null);
  if (reliable.length < 2) return null;
  let best: { from: number; to: number; avg: number } | null = null;
  for (const width of [3, 2]) {
    for (let h = 0; h + width <= 24; h++) {
      const span = cells.slice(h, h + width);
      if (!span.every((c) => c.sessions >= MIN_SESSIONS_PER_HOUR && c.avgFocus != null)) continue;
      const avg = span.reduce((a, c) => a + (c.avgFocus as number), 0) / width;
      if (!best || avg > best.avg) best = { from: h, to: h + width, avg };
    }
    if (best) break;
  }
  if (!best) return null;
  const others = reliable.filter((c) => c.hour < best.from || c.hour >= best.to);
  const otherAvg = others.length ? others.reduce((a, c) => a + (c.avgFocus as number), 0) / others.length : null;
  return { ...best, otherAvg };
}

export type SubjectEffort = { id: string; name: string; weight: number | null; seconds: number; timeShare: number; weightShare: number | null; underInvested: boolean };

/**
 * Compares each subject's share of study time with its share of exam weight.
 * Under-invested = time share below 60% of its weight share.
 */
export function effortVsWeight(subjects: Array<{ id: string; name: string; weight: number | null }>, secondsBySubject: Map<string, number>): { rows: SubjectEffort[]; hasWeights: boolean } {
  const totalSeconds = subjects.reduce((a, s) => a + (secondsBySubject.get(s.id) ?? 0), 0);
  const weighted = subjects.filter((s) => s.weight != null && s.weight > 0);
  const totalWeight = weighted.reduce((a, s) => a + (s.weight as number), 0);
  const rows = subjects.map((s) => {
    const seconds = secondsBySubject.get(s.id) ?? 0;
    const timeShare = totalSeconds ? seconds / totalSeconds : 0;
    const weightShare = s.weight != null && totalWeight ? s.weight / totalWeight : null;
    return { id: s.id, name: s.name, weight: s.weight, seconds, timeShare, weightShare, underInvested: weightShare != null && totalSeconds > 0 && timeShare < 0.6 * weightShare };
  });
  rows.sort((a, b) => (b.weightShare ?? 0) - (a.weightShare ?? 0) || b.seconds - a.seconds);
  return { rows, hasWeights: weighted.length > 0 };
}

/** Per-day facts used for observations. Missing values are null, never guessed. */
export type DayFacts = {
  date: LocalDate;
  studySeconds: number;
  avgFocus: number | null;
  sleepHours: number | null;
  energy: number | null;
  /** Total occurrences of the tracked reduce habit, if any is tracked on that day. */
  reduceCount: number | null;
};

export type Observation = {
  id: "sleep-focus" | "energy-study" | "reduce-lowstudy";
  text: string;
  n: number;
  strength: "early" | "pattern";
  a: number;
  b: number;
};

function mean(xs: number[]) {
  return xs.reduce((a, x) => a + x, 0) / xs.length;
}

function compare(
  facts: DayFacts[],
  pick: (f: DayFacts) => { group: "a" | "b"; value: number } | null,
): { a: number; b: number; n: number } | null {
  const a: number[] = [];
  const b: number[] = [];
  for (const f of facts) {
    const p = pick(f);
    if (!p) continue;
    (p.group === "a" ? a : b).push(p.value);
  }
  const n = a.length + b.length;
  if (n < MIN_PAIRED_DAYS || a.length < MIN_GROUP_DAYS || b.length < MIN_GROUP_DAYS) return null;
  const ma = mean(a);
  const mb = mean(b);
  const denom = Math.max(Math.abs(ma), Math.abs(mb));
  if (denom === 0 || Math.abs(ma - mb) / denom < MIN_RELATIVE_DIFF) return null;
  return { a: ma, b: mb, n };
}

const fmt1 = (x: number) => Number(x.toFixed(1)).toString();

export function observations(facts: DayFacts[], reduceHabitName?: string | null): Observation[] {
  const out: Observation[] = [];
  const strength = (n: number) => (n < STRONG_PAIRED_DAYS ? "early" : "pattern") as Observation["strength"];

  const sleep = compare(facts, (f) => (f.sleepHours == null || f.avgFocus == null ? null : { group: f.sleepHours >= 7 ? "a" : "b", value: f.avgFocus }));
  if (sleep) {
    out.push({
      id: "sleep-focus",
      text: `Your focus averages ${fmt1(sleep.a)} on days after 7h+ sleep, and ${fmt1(sleep.b)} otherwise.`,
      n: sleep.n,
      strength: strength(sleep.n),
      a: sleep.a,
      b: sleep.b,
    });
  }

  const energy = compare(facts, (f) => (f.energy == null ? null : { group: f.energy < 5 ? "a" : "b", value: f.studySeconds / 60 }));
  if (energy) {
    const diff = Math.round(Math.abs(energy.b - energy.a));
    out.push({
      id: "energy-study",
      text: `On days your energy is below 5 you study ${Math.round(energy.a)} min on average, vs ${Math.round(energy.b)} min otherwise (${diff} min ${energy.a < energy.b ? "less" : "more"}).`,
      n: energy.n,
      strength: strength(energy.n),
      a: energy.a,
      b: energy.b,
    });
  }

  if (reduceHabitName) {
    const reduce = compare(facts, (f) => (f.reduceCount == null ? null : { group: f.studySeconds < 3600 ? "a" : "b", value: f.reduceCount }));
    if (reduce) {
      out.push({
        id: "reduce-lowstudy",
        text: `“${reduceHabitName}” averages ${fmt1(reduce.a)} a day on days you study under an hour, and ${fmt1(reduce.b)} on other days.`,
        n: reduce.n,
        strength: strength(reduce.n),
        a: reduce.a,
        b: reduce.b,
      });
    }
  }
  return out;
}

/** Trend between the older and newer half of a window: rates in 0–1. */
export function trendDirection(older: number | null, newer: number | null, threshold = 0.05): "up" | "down" | "flat" | null {
  if (older == null || newer == null) return null;
  if (newer - older > threshold) return "up";
  if (older - newer > threshold) return "down";
  return "flat";
}
