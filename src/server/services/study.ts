import "server-only";
import { TZDate } from "@date-fns/tz";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { addLocalDays, diffLocalDays, localDateIn, type LocalDate } from "@/domain/dates";
import { overdueDays, scheduleRevisions } from "@/domain/revisions";
import { closePause, elapsedSeconds, MAX_SESSION_SECONDS, statusForProgress, subjectProgress, type StudyMethod } from "@/domain/study";
import { db, type Tx } from "@/server/db";
import { goals, revisions, studySessions, subjects, topics } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/result";
import { getSettings } from "./settings";

export type Subject = typeof subjects.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type Revision = typeof revisions.$inferSelect;

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  const code = e?.code ?? e?.cause?.code;
  return typeof code === "string" ? code : undefined;
}

/** Converts a wall-clock time on a calendar day in `timeZone` to a UTC instant. */
export function localDateTimeToInstant(date: LocalDate, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, timeZone).getTime());
}

/* ------------------------------------------------------------------ */
/* Ownership guards                                                    */
/* ------------------------------------------------------------------ */

async function assertGoalOwned(userId: string, goalId: string | null | undefined) {
  if (!goalId) return;
  const g = await db.query.goals.findFirst({ where: and(eq(goals.id, goalId), eq(goals.userId, userId)), columns: { id: true } });
  if (!g) throw new UserFacingError("That goal no longer exists.", { goalId: "Choose another goal" });
}

export async function getSubject(userId: string, id: string): Promise<Subject> {
  const s = await db.query.subjects.findFirst({ where: and(eq(subjects.id, id), eq(subjects.userId, userId)) });
  if (!s) throw new NotFoundError("That subject");
  return s;
}

export async function getTopic(userId: string, id: string): Promise<Topic> {
  const t = await db.query.topics.findFirst({ where: and(eq(topics.id, id), eq(topics.userId, userId)) });
  if (!t) throw new NotFoundError("That topic");
  return t;
}

/**
 * Resolves the subject/topic pair for a session: the topic must belong to the
 * user and, when both are given, to that subject. A topic alone implies its subject.
 */
async function resolveSubjectTopic(userId: string, subjectId?: string | null, topicId?: string | null): Promise<{ subjectId: string | null; topicId: string | null }> {
  if (topicId) {
    const topic = await getTopic(userId, topicId);
    if (subjectId && topic.subjectId !== subjectId) throw new UserFacingError("That topic belongs to a different subject.", { topicId: "Pick a topic from this subject" });
    return { subjectId: topic.subjectId, topicId };
  }
  if (subjectId) {
    await getSubject(userId, subjectId);
    return { subjectId, topicId: null };
  }
  return { subjectId: null, topicId: null };
}

/* ------------------------------------------------------------------ */
/* Subjects                                                            */
/* ------------------------------------------------------------------ */

export type SubjectInput = { name: string; goalId?: string | null; weight?: number | null };

export type SubjectSummary = Subject & {
  goalTitle: string | null;
  topicCount: number;
  completedCount: number;
  progress: number;
  studySeconds: number;
};

export async function listSubjectSummaries(userId: string, opts: { includeArchived?: boolean } = {}): Promise<SubjectSummary[]> {
  const rows = await db
    .select({ subject: subjects, goalTitle: goals.title })
    .from(subjects)
    .leftJoin(goals, eq(goals.id, subjects.goalId))
    .where(opts.includeArchived ? eq(subjects.userId, userId) : and(eq(subjects.userId, userId), isNull(subjects.archivedAt)))
    .orderBy(asc(subjects.position), asc(subjects.createdAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.subject.id);
  const [topicRows, timeRows] = await Promise.all([
    db
      .select({ subjectId: topics.subjectId, progress: topics.progress, status: topics.status })
      .from(topics)
      .where(and(eq(topics.userId, userId), inArray(topics.subjectId, ids))),
    db
      .select({ subjectId: studySessions.subjectId, seconds: sql<string>`coalesce(sum(${studySessions.durationSeconds}), 0)` })
      .from(studySessions)
      .where(and(eq(studySessions.userId, userId), inArray(studySessions.subjectId, ids), isNotNull(studySessions.endedAt)))
      .groupBy(studySessions.subjectId),
  ]);
  const time = new Map(timeRows.map((r) => [r.subjectId, Number(r.seconds)]));
  return rows.map(({ subject, goalTitle }) => {
    const ts = topicRows.filter((t) => t.subjectId === subject.id);
    return {
      ...subject,
      goalTitle,
      topicCount: ts.length,
      completedCount: ts.filter((t) => t.status === "completed").length,
      progress: subjectProgress(ts.map((t) => t.progress)),
      studySeconds: time.get(subject.id) ?? 0,
    };
  });
}

export async function listSubjectOptions(userId: string): Promise<Array<{ id: string; name: string }>> {
  return db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.userId, userId), isNull(subjects.archivedAt)))
    .orderBy(asc(subjects.position), asc(subjects.createdAt));
}

export async function createSubject(userId: string, input: SubjectInput): Promise<Subject> {
  await assertGoalOwned(userId, input.goalId);
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${subjects.position}), -1) + 1` })
    .from(subjects)
    .where(eq(subjects.userId, userId));
  const [row] = await db
    .insert(subjects)
    .values({ userId, name: input.name.trim(), goalId: input.goalId ?? null, weight: input.weight ?? null, position: Number(next) })
    .returning();
  return row;
}

export async function updateSubject(userId: string, id: string, input: SubjectInput): Promise<Subject> {
  await assertGoalOwned(userId, input.goalId);
  const [row] = await db
    .update(subjects)
    .set({ name: input.name.trim(), goalId: input.goalId ?? null, weight: input.weight ?? null })
    .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
    .returning();
  if (!row) throw new NotFoundError("That subject");
  return row;
}

export async function setSubjectArchived(userId: string, id: string, archived: boolean): Promise<void> {
  const res = await db
    .update(subjects)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
    .returning({ id: subjects.id });
  if (!res.length) throw new NotFoundError("That subject");
}

/** Deletes the subject and its topics/revisions. Logged sessions are kept (unlinked) so study time history survives. */
export async function deleteSubject(userId: string, id: string): Promise<void> {
  const res = await db.delete(subjects).where(and(eq(subjects.id, id), eq(subjects.userId, userId))).returning({ id: subjects.id });
  if (!res.length) throw new NotFoundError("That subject");
}

/* ------------------------------------------------------------------ */
/* Topics                                                              */
/* ------------------------------------------------------------------ */

export async function listTopics(userId: string, subjectId: string): Promise<Topic[]> {
  return db.query.topics.findMany({
    where: and(eq(topics.userId, userId), eq(topics.subjectId, subjectId)),
    orderBy: [asc(topics.position), asc(topics.createdAt)],
  });
}

export async function listTopicOptions(userId: string): Promise<Array<{ id: string; name: string; subjectId: string; subjectName: string }>> {
  return db
    .select({ id: topics.id, name: topics.name, subjectId: topics.subjectId, subjectName: subjects.name })
    .from(topics)
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .where(and(eq(topics.userId, userId), isNull(subjects.archivedAt)))
    .orderBy(asc(subjects.position), asc(topics.position), asc(topics.createdAt));
}

export async function createTopic(userId: string, subjectId: string, name: string): Promise<Topic> {
  await getSubject(userId, subjectId);
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${topics.position}), -1) + 1` })
    .from(topics)
    .where(eq(topics.subjectId, subjectId));
  const [row] = await db.insert(topics).values({ userId, subjectId, name: name.trim(), position: Number(next) }).returning();
  return row;
}

export async function renameTopic(userId: string, id: string, name: string): Promise<void> {
  const res = await db.update(topics).set({ name: name.trim() }).where(and(eq(topics.id, id), eq(topics.userId, userId))).returning({ id: topics.id });
  if (!res.length) throw new NotFoundError("That topic");
}

export async function deleteTopic(userId: string, id: string): Promise<void> {
  const res = await db.delete(topics).where(and(eq(topics.id, id), eq(topics.userId, userId))).returning({ id: topics.id });
  if (!res.length) throw new NotFoundError("That topic");
}

/** Swaps the topic with its neighbour. Positions are renumbered so gaps or ties can't break ordering. */
export async function moveTopic(userId: string, id: string, direction: "up" | "down"): Promise<void> {
  const topic = await getTopic(userId, id);
  await db.transaction(async (tx) => {
    const siblings = await tx
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.userId, userId), eq(topics.subjectId, topic.subjectId)))
      .orderBy(asc(topics.position), asc(topics.createdAt))
      .for("update");
    const order = siblings.map((s) => s.id);
    const i = order.indexOf(id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    for (const [position, topicId] of order.entries()) {
      await tx.update(topics).set({ position }).where(eq(topics.id, topicId));
    }
  });
}

export async function setTopicProgress(userId: string, id: string, progress: number): Promise<Topic> {
  const topic = await getTopic(userId, id);
  const value = Math.round(Math.max(0, Math.min(100, progress)));
  const [row] = await db
    .update(topics)
    .set({ progress: value, status: statusForProgress(value, topic.status) })
    .where(and(eq(topics.id, id), eq(topics.userId, userId)))
    .returning();
  return row;
}

/**
 * Marks a topic complete (progress 100, revisions scheduled from the user's
 * schedule) or reopens it (future uncompleted revisions removed, history kept).
 * Idempotent: completing twice never duplicates revisions.
 */
export async function setTopicCompleted(userId: string, id: string, completed: boolean, today: LocalDate): Promise<Topic> {
  const topic = await getTopic(userId, id);
  const settings = await getSettings(userId);
  return db.transaction(async (tx: Tx) => {
    if (completed) {
      const [row] = await tx
        .update(topics)
        .set({ status: "completed", progress: 100, completedAt: topic.completedAt ?? new Date() })
        .where(and(eq(topics.id, id), eq(topics.userId, userId)))
        .returning();
      const plan = scheduleRevisions(today, settings.revisionScheduleDays);
      if (plan.length) {
        await tx
          .insert(revisions)
          .values(plan.map((p) => ({ userId, topicId: id, step: p.step, dueDate: p.dueDate })))
          .onConflictDoNothing({ target: [revisions.topicId, revisions.step] });
      }
      return row;
    }
    const [row] = await tx
      .update(topics)
      .set({ status: topic.progress > 0 ? "in_progress" : "not_started", progress: Math.min(topic.progress, 95), completedAt: null })
      .where(and(eq(topics.id, id), eq(topics.userId, userId)))
      .returning();
    await tx.delete(revisions).where(and(eq(revisions.topicId, id), eq(revisions.userId, userId), isNull(revisions.completedAt)));
    return row;
  });
}

/* ------------------------------------------------------------------ */
/* Revisions                                                           */
/* ------------------------------------------------------------------ */

export type DueRevision = { id: string; step: number; dueDate: LocalDate; overdueDays: number; topicId: string; topicName: string; subjectId: string; subjectName: string };

/** Revisions due today or overdue, oldest first. Skipped/completed excluded. */
export async function revisionsDue(userId: string, today: LocalDate): Promise<DueRevision[]> {
  const rows = await db
    .select({ id: revisions.id, step: revisions.step, dueDate: revisions.dueDate, topicId: topics.id, topicName: topics.name, subjectId: subjects.id, subjectName: subjects.name })
    .from(revisions)
    .innerJoin(topics, eq(topics.id, revisions.topicId))
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .where(
      and(
        eq(revisions.userId, userId),
        lte(revisions.dueDate, today),
        isNull(revisions.completedAt),
        isNull(revisions.skippedAt),
        isNull(subjects.archivedAt),
        // Only the earliest outstanding step per topic: Rev 4 isn't "due" while Rev 1 is still open.
        sql`not exists (select 1 from ${revisions} r2 where r2.topic_id = ${revisions.topicId} and r2.step < ${revisions.step} and r2.completed_at is null and r2.skipped_at is null)`,
      ),
    )
    .orderBy(asc(revisions.dueDate), asc(revisions.step));
  return rows.map((r) => ({ ...r, overdueDays: overdueDays(r.dueDate, today) }));
}

export async function topicRevisions(userId: string, topicIds: string[]): Promise<Map<string, Revision[]>> {
  const out = new Map<string, Revision[]>(topicIds.map((id) => [id, []]));
  if (!topicIds.length) return out;
  const rows = await db.query.revisions.findMany({
    where: and(eq(revisions.userId, userId), inArray(revisions.topicId, topicIds)),
    orderBy: [asc(revisions.step)],
  });
  for (const r of rows) out.get(r.topicId)?.push(r);
  return out;
}

async function getRevision(userId: string, id: string): Promise<Revision> {
  const r = await db.query.revisions.findFirst({ where: and(eq(revisions.id, id), eq(revisions.userId, userId)) });
  if (!r) throw new NotFoundError("That revision");
  return r;
}

/** Idempotent: completing an already-completed revision is a no-op. Returns previous state for Undo. */
export async function completeRevision(userId: string, id: string): Promise<{ wasCompleted: boolean }> {
  const r = await getRevision(userId, id);
  if (!r.completedAt) await db.update(revisions).set({ completedAt: new Date(), skippedAt: null }).where(eq(revisions.id, id));
  return { wasCompleted: !!r.completedAt };
}

export async function reopenRevision(userId: string, id: string): Promise<void> {
  await getRevision(userId, id);
  await db.update(revisions).set({ completedAt: null }).where(eq(revisions.id, id));
}

/** Moves the revision to tomorrow (never earlier than its current due date). */
export async function snoozeRevision(userId: string, id: string, today: LocalDate): Promise<{ previousDueDate: LocalDate }> {
  const r = await getRevision(userId, id);
  if (r.completedAt) throw new UserFacingError("That revision is already done.");
  const tomorrow = addLocalDays(today, 1);
  const next = diffLocalDays(r.dueDate, tomorrow) > 0 ? r.dueDate : tomorrow;
  await db.update(revisions).set({ dueDate: next }).where(eq(revisions.id, id));
  return { previousDueDate: r.dueDate };
}

export async function setRevisionDueDate(userId: string, id: string, dueDate: LocalDate): Promise<void> {
  await getRevision(userId, id);
  await db.update(revisions).set({ dueDate }).where(eq(revisions.id, id));
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export type SessionWithNames = StudySession & { subjectName: string | null; topicName: string | null };

const sessionSelect = { session: studySessions, subjectName: subjects.name, topicName: topics.name };

function flatten(rows: Array<{ session: StudySession; subjectName: string | null; topicName: string | null }>): SessionWithNames[] {
  return rows.map((r) => ({ ...r.session, subjectName: r.subjectName, topicName: r.topicName }));
}

export async function getRunningSession(userId: string): Promise<SessionWithNames | null> {
  const rows = await db
    .select(sessionSelect)
    .from(studySessions)
    .leftJoin(subjects, eq(subjects.id, studySessions.subjectId))
    .leftJoin(topics, eq(topics.id, studySessions.topicId))
    .where(and(eq(studySessions.userId, userId), isNull(studySessions.endedAt)))
    .limit(1);
  return flatten(rows)[0] ?? null;
}

export async function getSession(userId: string, id: string): Promise<SessionWithNames> {
  const rows = await db
    .select(sessionSelect)
    .from(studySessions)
    .leftJoin(subjects, eq(subjects.id, studySessions.subjectId))
    .leftJoin(topics, eq(topics.id, studySessions.topicId))
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
    .limit(1);
  const s = flatten(rows)[0];
  if (!s) throw new NotFoundError("That session");
  return s;
}

/**
 * Starts a session. The database allows only one running session per user, so a
 * double click or a second tab gets the existing session back instead of a duplicate.
 */
export async function startSession(
  userId: string,
  input: { subjectId?: string | null; topicId?: string | null; method?: StudyMethod | null },
  now = new Date(),
): Promise<{ id: string; alreadyRunning: boolean }> {
  const running = await getRunningSession(userId);
  if (running) return { id: running.id, alreadyRunning: true };
  const link = await resolveSubjectTopic(userId, input.subjectId, input.topicId);
  const { timezone } = await getSettings(userId);
  try {
    const [row] = await db
      .insert(studySessions)
      .values({ userId, ...link, method: input.method ?? null, startedAt: now, localDate: localDateIn(timezone, now) })
      .returning({ id: studySessions.id });
    return { id: row.id, alreadyRunning: false };
  } catch (err) {
    if (pgCode(err) === "23505") {
      const existing = await getRunningSession(userId);
      if (existing) return { id: existing.id, alreadyRunning: true };
    }
    throw err;
  }
}

async function lockRunning(tx: Tx, userId: string, id: string): Promise<StudySession> {
  const [s] = await tx
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
    .for("update");
  if (!s) throw new NotFoundError("That session");
  if (s.endedAt) throw new UserFacingError("That session has already finished.");
  return s;
}

export async function pauseSession(userId: string, id: string, now = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const s = await lockRunning(tx, userId, id);
    if (s.pausedAt) return; // already paused — idempotent
    await tx.update(studySessions).set({ pausedAt: now }).where(eq(studySessions.id, id));
  });
}

export async function resumeSession(userId: string, id: string, now = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const s = await lockRunning(tx, userId, id);
    if (!s.pausedAt) return;
    await tx.update(studySessions).set({ pausedAt: null, pausedSeconds: closePause(s, now) }).where(eq(studySessions.id, id));
  });
}

/** Records a correct or missed question on the running session (atomic, survives refresh). */
export async function tallySession(userId: string, id: string, result: "correct" | "missed" | "undo-correct" | "undo-missed"): Promise<{ attempted: number; correct: number }> {
  return db.transaction(async (tx) => {
    const s = await lockRunning(tx, userId, id);
    let attempted = s.questionsAttempted ?? 0;
    let correct = s.questionsCorrect ?? 0;
    if (result === "correct") {
      attempted++;
      correct++;
    } else if (result === "missed") attempted++;
    else if (result === "undo-correct" && correct > 0) {
      attempted--;
      correct--;
    } else if (result === "undo-missed" && attempted > correct) attempted--;
    await tx.update(studySessions).set({ questionsAttempted: attempted, questionsCorrect: correct }).where(eq(studySessions.id, id));
    return { attempted, correct };
  });
}

/** Stops the timer. Duration excludes pauses and is computed from server time only. */
export async function finishSession(userId: string, id: string, now = new Date()): Promise<{ id: string; durationSeconds: number }> {
  return db.transaction(async (tx) => {
    const [s] = await tx
      .select()
      .from(studySessions)
      .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
      .for("update");
    if (!s) throw new NotFoundError("That session");
    if (s.endedAt) return { id, durationSeconds: s.durationSeconds ?? 0 }; // double click — idempotent
    const pausedSeconds = closePause(s, now);
    const durationSeconds = elapsedSeconds({ ...s, pausedAt: null, pausedSeconds, endedAt: now }, now);
    await tx.update(studySessions).set({ endedAt: now, pausedAt: null, pausedSeconds, durationSeconds }).where(eq(studySessions.id, id));
    return { id, durationSeconds };
  });
}

export type SessionDetails = {
  subjectId?: string | null;
  topicId?: string | null;
  method?: StudyMethod | null;
  focus?: number | null;
  questionsAttempted?: number | null;
  questionsCorrect?: number | null;
  notes?: string | null;
};

export async function updateSessionDetails(userId: string, id: string, details: SessionDetails): Promise<void> {
  await getSession(userId, id);
  const link = await resolveSubjectTopic(userId, details.subjectId, details.topicId);
  if (details.questionsAttempted != null && details.questionsCorrect != null && details.questionsCorrect > details.questionsAttempted) {
    throw new UserFacingError("Correct can’t be more than attempted.", { questionsCorrect: "Must be ≤ attempted" });
  }
  await db
    .update(studySessions)
    .set({
      ...link,
      method: details.method ?? null,
      focus: details.focus ?? null,
      questionsAttempted: details.questionsAttempted ?? null,
      questionsCorrect: details.questionsCorrect ?? null,
      notes: details.notes?.trim() || null,
    })
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)));
}

function validateTimes(start: Date, end: Date, now: Date) {
  if (end.getTime() <= start.getTime()) throw new UserFacingError("End time must be after the start.", { endTime: "Must be after start" });
  if (end.getTime() > now.getTime() + 60_000) throw new UserFacingError("A session can’t end in the future.", { endTime: "That’s in the future" });
  if ((end.getTime() - start.getTime()) / 1000 > MAX_SESSION_SECONDS) throw new UserFacingError("Sessions can be at most 16 hours. Split longer stretches into separate sessions.", { endTime: "Max 16 hours" });
}

/**
 * Corrects a finished session's times. `startTime`/`endTime` are wall-clock times
 * on `date` in the user's timezone; an end earlier than the start means it ran past midnight.
 */
export async function editSessionTimes(userId: string, id: string, input: { date: LocalDate; startTime: string; endTime: string }, now = new Date()): Promise<{ durationSeconds: number }> {
  const s = await getSession(userId, id);
  if (!s.endedAt) throw new UserFacingError("Finish the session before editing its times.");
  const { timezone } = await getSettings(userId);
  const start = localDateTimeToInstant(input.date, input.startTime, timezone);
  let end = localDateTimeToInstant(input.date, input.endTime, timezone);
  if (end.getTime() <= start.getTime()) end = localDateTimeToInstant(addLocalDays(input.date, 1), input.endTime, timezone);
  validateTimes(start, end, now);
  const durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
  await db
    .update(studySessions)
    .set({ startedAt: start, endedAt: end, pausedAt: null, pausedSeconds: 0, durationSeconds, localDate: input.date })
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)));
  return { durationSeconds };
}

/** Shortens a finished session to end at `end` (used by the forgotten-timer prompt). */
export async function trimSession(userId: string, id: string, end: Date): Promise<{ durationSeconds: number }> {
  const s = await getSession(userId, id);
  if (!s.endedAt) throw new UserFacingError("Finish the session before trimming it.");
  if (end.getTime() <= s.startedAt.getTime() || end.getTime() > s.endedAt.getTime()) throw new UserFacingError("Pick a time between the start and the end.");
  const pausedSeconds = Math.min(s.pausedSeconds, Math.floor((end.getTime() - s.startedAt.getTime()) / 1000));
  const durationSeconds = elapsedSeconds({ startedAt: s.startedAt, endedAt: end, pausedAt: null, pausedSeconds }, end);
  await db.update(studySessions).set({ endedAt: end, pausedSeconds, durationSeconds }).where(eq(studySessions.id, id));
  return { durationSeconds };
}

export async function logPastSession(
  userId: string,
  input: { date: LocalDate; startTime: string; endTime: string } & SessionDetails,
  now = new Date(),
): Promise<{ id: string }> {
  const link = await resolveSubjectTopic(userId, input.subjectId, input.topicId);
  const { timezone } = await getSettings(userId);
  const start = localDateTimeToInstant(input.date, input.startTime, timezone);
  let end = localDateTimeToInstant(input.date, input.endTime, timezone);
  if (end.getTime() <= start.getTime()) end = localDateTimeToInstant(addLocalDays(input.date, 1), input.endTime, timezone);
  validateTimes(start, end, now);
  if (input.questionsAttempted != null && input.questionsCorrect != null && input.questionsCorrect > input.questionsAttempted) {
    throw new UserFacingError("Correct can’t be more than attempted.", { questionsCorrect: "Must be ≤ attempted" });
  }
  const [row] = await db
    .insert(studySessions)
    .values({
      userId,
      ...link,
      method: input.method ?? null,
      startedAt: start,
      endedAt: end,
      localDate: input.date,
      durationSeconds: Math.floor((end.getTime() - start.getTime()) / 1000),
      focus: input.focus ?? null,
      questionsAttempted: input.questionsAttempted ?? null,
      questionsCorrect: input.questionsCorrect ?? null,
      notes: input.notes?.trim() || null,
    })
    .returning({ id: studySessions.id });
  return row;
}

export async function deleteSession(userId: string, id: string): Promise<void> {
  const res = await db.delete(studySessions).where(and(eq(studySessions.id, id), eq(studySessions.userId, userId))).returning({ id: studySessions.id });
  if (!res.length) throw new NotFoundError("That session");
}

/** Finished sessions whose day falls in [start, end], newest first. */
export async function listSessionsInRange(userId: string, start: LocalDate, end: LocalDate): Promise<SessionWithNames[]> {
  const rows = await db
    .select(sessionSelect)
    .from(studySessions)
    .leftJoin(subjects, eq(subjects.id, studySessions.subjectId))
    .leftJoin(topics, eq(topics.id, studySessions.topicId))
    .where(and(eq(studySessions.userId, userId), isNotNull(studySessions.endedAt), gte(studySessions.localDate, start), lte(studySessions.localDate, end)))
    .orderBy(desc(studySessions.startedAt));
  return flatten(rows);
}

export async function recentSessions(userId: string, opts: { subjectId?: string; limit?: number } = {}): Promise<SessionWithNames[]> {
  const rows = await db
    .select(sessionSelect)
    .from(studySessions)
    .leftJoin(subjects, eq(subjects.id, studySessions.subjectId))
    .leftJoin(topics, eq(topics.id, studySessions.topicId))
    .where(and(eq(studySessions.userId, userId), isNotNull(studySessions.endedAt), opts.subjectId ? eq(studySessions.subjectId, opts.subjectId) : undefined))
    .orderBy(desc(studySessions.startedAt))
    .limit(opts.limit ?? 10);
  return flatten(rows);
}

/** Total finished study seconds per day in [start, end]. Days without study are absent. */
export async function studySecondsByDay(userId: string, start: LocalDate, end: LocalDate): Promise<Map<LocalDate, number>> {
  const rows = await db
    .select({ day: studySessions.localDate, seconds: sql<string>`coalesce(sum(${studySessions.durationSeconds}), 0)` })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), isNotNull(studySessions.endedAt), gte(studySessions.localDate, start), lte(studySessions.localDate, end)))
    .groupBy(studySessions.localDate);
  return new Map(rows.map((r) => [r.day, Number(r.seconds)]));
}

export async function subjectQuestionTotals(userId: string, subjectId: string): Promise<Array<{ questionsAttempted: number | null; questionsCorrect: number | null }>> {
  return db
    .select({ questionsAttempted: studySessions.questionsAttempted, questionsCorrect: studySessions.questionsCorrect })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), eq(studySessions.subjectId, subjectId), isNotNull(studySessions.endedAt)));
}

/** Total finished study time for a subject and its linked goal (if the user still owns it). */
export async function subjectTotals(userId: string, subject: Subject): Promise<{ studySeconds: number; goal: { id: string; title: string } | null }> {
  const [[total], goal] = await Promise.all([
    db
      .select({ s: sql<string>`coalesce(sum(${studySessions.durationSeconds}), 0)` })
      .from(studySessions)
      .where(and(eq(studySessions.userId, userId), eq(studySessions.subjectId, subject.id), isNotNull(studySessions.endedAt))),
    subject.goalId ? db.query.goals.findFirst({ where: and(eq(goals.id, subject.goalId), eq(goals.userId, userId)), columns: { id: true, title: true } }) : Promise.resolve(undefined),
  ]);
  return { studySeconds: Number(total?.s ?? 0), goal: goal ?? null };
}
