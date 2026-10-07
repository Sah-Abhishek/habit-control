import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { addLocalDays, diffLocalDays, eachLocalDay, localDateIn, startOfLocalDay, startOfWeek, type LocalDate } from "@/domain/dates";
import { dayScore, sleepStudyObservation } from "@/domain/day-score";
import { dayState } from "@/domain/habits";
import { db } from "@/server/db";
import { goals, subjects, tasks, topics, user } from "@/server/db/schema";
import { getDay, getDaysInRange, type Day } from "./days";
import { getLogMaps, listHabits, toDef } from "./habits";
import { getRunningSession, listSessionsInRange, studySecondsByDay } from "./study";

export type DayAggregate = {
  date: LocalDate;
  studySeconds: number;
  studyTargetMet: boolean;
  habitsScheduled: number;
  habitsSucceeded: number;
  /** Names of habits that succeeded (build done / reduce within limit). */
  habitsDone: string[];
  /** A reduce habit went over its limit. */
  reduceOver: boolean;
  tasksDue: number;
  tasksCompleted: number;
  completedTaskTitles: string[];
  score: number | null;
  day: Day | null;
  isFuture: boolean;
};

/**
 * Per-day aggregates for a date range (calendar month/week, weekly bars).
 * Bounded to ~6 weeks per call by callers; a handful of grouped queries, no N+1.
 */
export async function aggregateDays(
  userId: string,
  start: LocalDate,
  end: LocalDate,
  opts: { today: LocalDate; timeZone: string; studyTargetMin: number; accountCreated?: LocalDate },
): Promise<DayAggregate[]> {
  const { today, timeZone, studyTargetMin } = opts;
  const [study, dueRows, doneRows, dayRows, habitList] = await Promise.all([
    studySecondsByDay(userId, start, end),
    db
      .select({ date: tasks.dueDate, n: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), gte(tasks.dueDate, start), lte(tasks.dueDate, end)))
      .groupBy(tasks.dueDate),
    db
      .select({ date: sql<string>`to_char(${tasks.completedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`, title: tasks.title })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNotNull(tasks.completedAt),
          // Pad the instant range by a day each side; exact day is matched after timezone conversion.
          gte(tasks.completedAt, new Date(`${addLocalDays(start, -1)}T00:00:00Z`)),
          lte(tasks.completedAt, new Date(`${addLocalDays(end, 2)}T00:00:00Z`)),
        ),
      ),
    getDaysInRange(userId, start, end),
    listHabits(userId, { includeArchived: true }),
  ]);
  const logMaps = await getLogMaps(userId, habitList.map((h) => h.id), start, end);

  const due = new Map(dueRows.map((r) => [r.date as string, Number(r.n)]));
  const done = new Map<string, string[]>();
  for (const r of doneRows) done.set(r.date, [...(done.get(r.date) ?? []), r.title]);
  const dayMap = new Map(dayRows.map((d) => [d.localDate, d]));

  return eachLocalDay(start, end).map((date) => {
    const isFuture = diffLocalDays(date, today) > 0;
    let habitsScheduled = 0;
    let habitsSucceeded = 0;
    let reduceOver = false;
    const habitsDone: string[] = [];
    for (const h of habitList) {
      // Archived habits count only for days before they were archived.
      if (h.archivedAt && diffLocalDays(date, localDateIn(timeZone, h.archivedAt)) >= 0) continue;
      const state = dayState(toDef(h), logMaps.get(h.id) ?? new Map(), date, today);
      if (state === "off" || state === "future") continue;
      if (state === "pending" && h.kind === "reduce") continue; // still open today
      habitsScheduled++;
      if (state === "done" || state === "clear" || state === "within") {
        habitsSucceeded++;
        habitsDone.push(h.name);
      }
      if (state === "over") reduceOver = true;
    }
    const studySeconds = study.get(date) ?? 0;
    const completedTaskTitles = done.get(date) ?? [];
    const tasksDue = due.get(date) ?? 0;
    const beforeAccount = opts.accountCreated ? diffLocalDays(date, opts.accountCreated) < 0 : false;
    const score =
      isFuture || beforeAccount
        ? null
        : dayScore({
            studyMinutes: studySeconds / 60,
            studyTargetMinutes: studyTargetMin,
            habitsScheduled,
            habitsSucceeded,
            tasksDue,
            tasksCompleted: completedTaskTitles.length,
          });
    return {
      date,
      studySeconds,
      studyTargetMet: studyTargetMin > 0 && studySeconds >= studyTargetMin * 60,
      habitsScheduled,
      habitsSucceeded,
      habitsDone,
      reduceOver,
      tasksDue,
      tasksCompleted: completedTaskTitles.length,
      completedTaskTitles,
      score,
      day: dayMap.get(date) ?? null,
      isFuture,
    };
  });
}

/** Day row → values for the check-in editor, with sleep times in the user's timezone. */
export function toCheckInValues(day: Day | null, timeZone: string) {
  const clock = (d: Date | null | undefined) => (d ? format(new TZDate(d.getTime(), timeZone), "HH:mm") : null);
  const minutes = day?.sleepStart && day?.sleepEnd ? Math.round((day.sleepEnd.getTime() - day.sleepStart.getTime()) / 60000) : null;
  return {
    mood: day?.mood ?? null,
    energy: day?.energy ?? null,
    stress: day?.stress ?? null,
    note: day?.note ?? null,
    bed: clock(day?.sleepStart),
    wake: clock(day?.sleepEnd),
    sleepQuality: day?.sleepQuality ?? null,
    sleepMinutes: minutes,
  };
}

/** Local date the account was created — days before it show as "no data", not empty. */
export async function accountStartDate(userId: string, timeZone: string): Promise<LocalDate> {
  const row = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { createdAt: true } });
  return localDateIn(timeZone, row?.createdAt ?? new Date());
}

/** "DBMS — Transactions" for a day's focus, or its free text. */
export async function focusLabelFor(userId: string, day: Day | null): Promise<string | null> {
  if (!day) return null;
  if (day.focusTopicId) {
    const [row] = await db
      .select({ topic: topics.name, subject: subjects.name })
      .from(topics)
      .innerJoin(subjects, eq(subjects.id, topics.subjectId))
      .where(and(eq(topics.id, day.focusTopicId), eq(topics.userId, userId)))
      .limit(1);
    if (row) return `${row.subject} — ${row.topic}`;
  }
  return day.focusText;
}

/* ------------------------------ Today dashboard ------------------------------ */

export type TimelineBlock = { startHour: number; endHour: number; kind: "sleep" | "study" | "running" };

export async function getTodayExtras(userId: string, today: LocalDate, timeZone: string, weekStartsOn: number) {
  const dayStart = startOfLocalDay(today, timeZone);
  const [day, sessionsToday, running, weekSeconds, history] = await Promise.all([
    getDay(userId, today),
    listSessionsInRange(userId, today, today),
    getRunningSession(userId),
    studySecondsByDay(userId, startOfWeek(today, weekStartsOn), addLocalDays(startOfWeek(today, weekStartsOn), 6)),
    Promise.all([getDaysInRange(userId, addLocalDays(today, -60), addLocalDays(today, -1)), studySecondsByDay(userId, addLocalDays(today, -60), addLocalDays(today, -1))]),
  ]);

  const hourOf = (d: Date) => Math.max(0, Math.min(24, (d.getTime() - dayStart.getTime()) / 3_600_000));
  const blocks: TimelineBlock[] = [];
  if (day?.sleepStart && day.sleepEnd) blocks.push({ startHour: hourOf(day.sleepStart), endHour: hourOf(day.sleepEnd), kind: "sleep" });
  for (const s of sessionsToday) if (s.endedAt) blocks.push({ startHour: hourOf(s.startedAt), endHour: hourOf(s.endedAt), kind: "study" });
  if (running && running.localDate === today) blocks.push({ startHour: hourOf(running.startedAt), endHour: hourOf(new Date()), kind: "running" });

  const studySecondsToday = sessionsToday.reduce((s, x) => s + (x.durationSeconds ?? 0), 0);
  const [pastDays, pastStudy] = history;
  const obsRows = pastDays
    .filter((d) => d.sleepStart && d.sleepEnd)
    .map((d) => ({ sleepHours: (d.sleepEnd!.getTime() - d.sleepStart!.getTime()) / 3_600_000, studyMinutes: (pastStudy.get(d.localDate) ?? 0) / 60 }));

  return {
    day,
    running,
    blocks: blocks.filter((b) => b.endHour > b.startHour),
    nowHour: Math.min(24, (Date.now() - dayStart.getTime()) / 3_600_000),
    studySecondsToday,
    weekStart: startOfWeek(today, weekStartsOn),
    weekSeconds,
    observation: sleepStudyObservation(obsRows),
  };
}

/** "Day 214 of 356" for a goal with both dates; null otherwise or outside the range. */
export async function goalDayCount(userId: string, goalId: string, today: LocalDate): Promise<{ day: number; total: number } | null> {
  const g = await db.query.goals.findFirst({ where: and(eq(goals.id, goalId), eq(goals.userId, userId)), columns: { startDate: true, targetDate: true } });
  if (!g?.targetDate) return null;
  const total = diffLocalDays(g.targetDate, g.startDate) + 1;
  const day = diffLocalDays(today, g.startDate) + 1;
  if (total <= 0 || day < 1 || day > total) return null;
  return { day, total };
}
