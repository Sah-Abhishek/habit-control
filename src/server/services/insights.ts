import "server-only";
import { and, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { addLocalDays, eachLocalDay, hourOfDayIn, localDateIn, type LocalDate } from "@/domain/dates";
import { consistency, thread, type ThreadTick } from "@/domain/habits";
import {
  RANGES,
  bestFocusWindow,
  effortVsWeight,
  focusByHour,
  observations,
  studyKpis,
  studySecondsByDay,
  trendDirection,
  weeklyStudy,
  type DayFacts,
  type RangeKey,
  type SessionPoint,
} from "@/domain/insights";
import { db } from "@/server/db";
import { days, revisions, studySessions, subjects } from "@/server/db/schema";
import { getLogMaps, listHabits, toDef } from "@/server/services/habits";
import { getSettings } from "@/server/services/settings";

const WEEKS_IN_CHART = 12;
const THREAD_DAYS = 90;

export type HabitThread = {
  id: string;
  name: string;
  kind: "build" | "reduce";
  ticks: ThreadTick[];
  rate: number | null;
  trend: ReturnType<typeof trendDirection>;
};

export type WellbeingPoint = { date: LocalDate; sleepHours: number | null; mood: number | null; energy: number | null };

export async function getInsights(userId: string, range: RangeKey) {
  const settings = await getSettings(userId);
  const tz = settings.timezone;
  const today = localDateIn(tz);
  const rangeDays = RANGES[range];
  const start = addLocalDays(today, -(rangeDays - 1));
  // Observations need enough history to be meaningful, whatever range is shown.
  const obsDays = Math.max(rangeDays, 90);
  const obsStart = addLocalDays(today, -(obsDays - 1));
  const fetchStart = [addLocalDays(start, -rangeDays), addLocalDays(today, -(WEEKS_IN_CHART * 7 + 7)), obsStart].sort()[0];

  const [sessionRows, subjectRows, revisionRow, dayRows, habitList] = await Promise.all([
    db
      .select({
        localDate: studySessions.localDate,
        durationSeconds: studySessions.durationSeconds,
        focus: studySessions.focus,
        questionsAttempted: studySessions.questionsAttempted,
        questionsCorrect: studySessions.questionsCorrect,
        startedAt: studySessions.startedAt,
        subjectId: studySessions.subjectId,
      })
      .from(studySessions)
      .where(and(eq(studySessions.userId, userId), isNotNull(studySessions.endedAt), gte(studySessions.localDate, fetchStart), lte(studySessions.localDate, today))),
    db
      .select({ id: subjects.id, name: subjects.name, weight: subjects.weight })
      .from(subjects)
      .where(and(eq(subjects.userId, userId), isNull(subjects.archivedAt))),
    db
      .select({
        due: sql<number>`count(*) filter (where ${revisions.skippedAt} is null)`,
        done: sql<number>`count(*) filter (where ${revisions.completedAt} is not null)`,
      })
      .from(revisions)
      .where(and(eq(revisions.userId, userId), gte(revisions.dueDate, start), lte(revisions.dueDate, today))),
    db
      .select({ localDate: days.localDate, sleepStart: days.sleepStart, sleepEnd: days.sleepEnd, mood: days.mood, energy: days.energy })
      .from(days)
      .where(and(eq(days.userId, userId), gte(days.localDate, [obsStart, start].sort()[0]), lte(days.localDate, today))),
    listHabits(userId),
  ]);

  const sessions: SessionPoint[] = sessionRows.map((r) => ({
    localDate: r.localDate,
    durationSeconds: Math.max(0, r.durationSeconds ?? 0),
    focus: r.focus,
    questionsAttempted: r.questionsAttempted,
    questionsCorrect: r.questionsCorrect,
    startHour: hourOfDayIn(tz, r.startedAt),
    subjectId: r.subjectId,
  }));
  const inRange = sessions.filter((s) => s.localDate >= start);
  const byDay = studySecondsByDay(sessions);
  const kpis = studyKpis(sessions, start, today);

  const secondsBySubject = new Map<string, number>();
  for (const s of inRange) if (s.subjectId) secondsBySubject.set(s.subjectId, (secondsBySubject.get(s.subjectId) ?? 0) + s.durationSeconds);
  const effort = effortVsWeight(subjectRows, secondsBySubject);

  const hours = focusByHour(inRange);

  // Habits: 90-day threads plus a trend comparing the older and newer halves.
  const habitStart = addLocalDays(today, -(Math.max(THREAD_DAYS, obsDays) + 1));
  const logMaps = await getLogMaps(userId, habitList.map((h) => h.id), habitStart, today);
  const threads: HabitThread[] = habitList.map((h) => {
    const def = toDef(h);
    const logs = logMaps.get(h.id) ?? new Map();
    const half = THREAD_DAYS / 2;
    const newer = consistency(def, logs, today, half).rate;
    const older = consistency(def, logs, addLocalDays(today, -half), half).rate;
    return { id: h.id, name: h.name, kind: h.kind, ticks: thread(def, logs, today, THREAD_DAYS), rate: consistency(def, logs, today, THREAD_DAYS).rate, trend: trendDirection(older, newer) };
  });

  // Wellbeing (chart) and per-day facts (observations).
  const sleepHours = (s: Date | null, e: Date | null) => (s && e && e > s ? (e.getTime() - s.getTime()) / 3_600_000 : null);
  const dayMap = new Map(dayRows.map((d) => [d.localDate, d]));
  const wellbeing: WellbeingPoint[] = eachLocalDay(start, today).map((date) => {
    const d = dayMap.get(date);
    return { date, sleepHours: d ? sleepHours(d.sleepStart, d.sleepEnd) : null, mood: d?.mood ?? null, energy: d?.energy ?? null };
  });

  const focusByDay = new Map<LocalDate, { sum: number; n: number }>();
  for (const s of sessions) {
    if (s.focus == null) continue;
    const f = focusByDay.get(s.localDate) ?? { sum: 0, n: 0 };
    f.sum += s.focus;
    f.n++;
    focusByDay.set(s.localDate, f);
  }
  const reduceHabit = habitList.find((h) => h.kind === "reduce");
  const reduceLogs = reduceHabit ? (logMaps.get(reduceHabit.id) ?? new Map<LocalDate, number>()) : null;
  const facts: DayFacts[] = eachLocalDay(obsStart, addLocalDays(today, -1)).map((date) => {
    const d = dayMap.get(date);
    const f = focusByDay.get(date);
    return {
      date,
      studySeconds: byDay.get(date) ?? 0,
      avgFocus: f ? f.sum / f.n : null,
      sleepHours: d ? sleepHours(d.sleepStart, d.sleepEnd) : null,
      energy: d?.energy ?? null,
      // Reduce habits: silence counts as zero, but only from the day tracking started.
      reduceCount: reduceHabit && reduceLogs && date >= reduceHabit.startedOn ? (reduceLogs.get(date) ?? 0) : null,
    };
  });

  return {
    range,
    rangeDays,
    start,
    today,
    targetSecondsPerDay: settings.dailyStudyTargetMin * 60,
    kpis,
    revisions: { due: Number(revisionRow[0]?.due ?? 0), done: Number(revisionRow[0]?.done ?? 0) },
    weeks: weeklyStudy(byDay, today, WEEKS_IN_CHART, settings.weekStartsOn),
    threads,
    effort,
    hours,
    bestWindow: bestFocusWindow(hours),
    wellbeing,
    observations: observations(facts, reduceHabit?.name),
    observationDays: obsDays,
  };
}

export type Insights = Awaited<ReturnType<typeof getInsights>>;
