/**
 * Weekly review text, generated deterministically from the week's numbers.
 * No AI: every sentence is a template filled with the user's own data, phrased as
 * an observation ("rose", "had", "was logged") — never a cause or a judgement.
 */
import { formatDuration } from "./format";

export type ReviewInput = {
  /** Seconds studied per day of the week (7 entries, oldest first), with future days flagged. */
  studyByDay: Array<{ date: string; seconds: number; future: boolean; weekday: string }>;
  prevStudySeconds: number;
  /** Daily study target in seconds (0 = no target). */
  targetSecondsPerDay: number;
  subjects: Array<{ id: string; name: string; seconds: number; weight: number | null }>;
  habits: Array<{ name: string; thisWeek: number | null; prevWeek: number | null }>;
  sleepHours: number[];
  prevSleepHours: number[];
};

export type ReviewText = { wentWell: string[]; needsAttention: string[]; suggestion: string | null };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const hoursText = (h: number) => formatDuration(h * 3600);

/** Relative change, or null when there is no baseline to compare against. */
export function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

export function buildReviewText(input: ReviewInput): ReviewText {
  const wentWell: string[] = [];
  const needsAttention: string[] = [];
  const days = input.studyByDay.filter((d) => !d.future);
  const total = days.reduce((s, d) => s + d.seconds, 0);
  const studied = days.filter((d) => d.seconds > 0);
  const weeklyTarget = input.targetSecondsPerDay * 7;

  if (days.length === 0) return { wentWell, needsAttention, suggestion: null };

  if (total === 0) {
    needsAttention.push("No study sessions were logged this week.");
    return { wentWell, needsAttention, suggestion: "Start small: one 25-minute session at the time of day you usually have the most energy." };
  }

  // Study volume vs last week.
  const change = changePct(total, input.prevStudySeconds);
  if (change != null && change >= 0.1) wentWell.push(`Study time rose ${pct(change)} to ${formatDuration(total)}.`);
  if (change != null && change <= -0.1) needsAttention.push(`Study time fell ${pct(-change)}, from ${formatDuration(input.prevStudySeconds)} to ${formatDuration(total)}.`);

  // Target.
  if (weeklyTarget > 0) {
    if (total >= weeklyTarget) wentWell.push(`You reached your weekly target of ${formatDuration(weeklyTarget)}.`);
    else if (total < weeklyTarget * 0.6 && days.length === 7) needsAttention.push(`You studied ${formatDuration(total)} of a ${formatDuration(weeklyTarget)} target.`);
  }

  // Consistency.
  if (studied.length >= 6) wentWell.push(`You studied on ${studied.length} of ${days.length} days.`);
  const gaps = days.filter((d) => d.seconds === 0);
  if (gaps.length >= 1 && gaps.length <= 2 && studied.length >= 3) {
    needsAttention.push(`No study on ${gaps.map((d) => d.weekday).join(" and ")}.`);
  } else if (studied.length <= 3 && days.length >= 5) {
    needsAttention.push(`Study happened on ${studied.length} of ${days.length} days.`);
  }

  // Subjects: where time went, and under-invested subjects relative to weight.
  const subjectTotal = input.subjects.reduce((s, x) => s + x.seconds, 0);
  const top = [...input.subjects].sort((a, b) => b.seconds - a.seconds)[0];
  if (top && top.seconds > 0 && subjectTotal > 0) wentWell.push(`Most time went to ${top.name} (${formatDuration(top.seconds)}).`);
  const weightTotal = input.subjects.reduce((s, x) => s + (x.weight ?? 0), 0);
  let neglected: { name: string; timeShare: number; weightShare: number; seconds: number } | null = null;
  if (weightTotal > 0 && subjectTotal > 0) {
    for (const s of input.subjects) {
      if (!s.weight) continue;
      const timeShare = s.seconds / subjectTotal;
      const weightShare = s.weight / weightTotal;
      if (timeShare < weightShare * 0.5 && (!neglected || weightShare - timeShare > neglected.weightShare - neglected.timeShare)) {
        neglected = { name: s.name, timeShare, weightShare, seconds: s.seconds };
      }
    }
  }
  if (neglected) {
    needsAttention.push(`${neglected.name} got ${formatDuration(neglected.seconds)} — ${pct(neglected.timeShare)} of your time for ${pct(neglected.weightShare)} of the weight.`);
  }

  // Habits: biggest rise and biggest drop vs last week (≥ 15 points).
  const moves = input.habits
    .filter((h) => h.thisWeek != null && h.prevWeek != null)
    .map((h) => ({ ...h, delta: (h.thisWeek as number) - (h.prevWeek as number) }));
  const rise = moves.filter((m) => m.delta >= 0.15).sort((a, b) => b.delta - a.delta)[0];
  const drop = moves.filter((m) => m.delta <= -0.15).sort((a, b) => a.delta - b.delta)[0];
  if (rise) wentWell.push(`${rise.name} consistency rose from ${pct(rise.prevWeek!)} to ${pct(rise.thisWeek!)}.`);
  if (drop) needsAttention.push(`${drop.name} consistency fell from ${pct(drop.prevWeek!)} to ${pct(drop.thisWeek!)}.`);

  // Sleep vs last week (≥ 30 minutes difference).
  const sleep = avg(input.sleepHours);
  const prevSleep = avg(input.prevSleepHours);
  if (sleep != null && prevSleep != null) {
    const diffMin = (sleep - prevSleep) * 60;
    if (diffMin >= 30) wentWell.push(`Average logged sleep rose ${Math.round(diffMin)}m to ${hoursText(sleep)}.`);
    if (diffMin <= -30) needsAttention.push(`Average logged sleep dropped ${Math.round(-diffMin)}m to ${hoursText(sleep)}.`);
  }

  // One concrete, optional adjustment — most specific first.
  let suggestion: string | null = null;
  if (neglected) {
    suggestion = `Add two 45-minute ${neglected.name} blocks next week to bring it closer to its share of the weight.`;
  } else if (studied.length <= 3 && days.length >= 5) {
    suggestion = "Try a shorter block on more days — e.g. 45 minutes daily — instead of a few long sessions.";
  } else if (weeklyTarget > 0 && total < weeklyTarget * 0.8 && days.length === 7) {
    const perDay = Math.round(total / 7 / 60);
    suggestion = `You averaged ${perDay}m a day against a ${Math.round(input.targetSecondsPerDay / 60)}m target. Consider a target you can hit on most days, then raise it.`;
  }
  return { wentWell, needsAttention, suggestion };
}
