import "server-only";
import { and, asc, desc, eq, gt, gte, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { addLocalDays, startOfLocalDay, type LocalDate } from "@/domain/dates";
import { db } from "@/server/db";
import { goals, subjects, tasks, topics } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/result";
import { getSettings } from "./settings";

export type Task = typeof tasks.$inferSelect;
export type Priority = Task["priority"];

/** Serializable row shape the task UI renders. */
export type TaskRowData = {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: Priority;
  estimateMinutes: number | null;
  completed: boolean;
  completedAt: Date | null;
  goalId: string | null;
  subjectId: string | null;
  topicId: string | null;
  goalTitle: string | null;
  subjectName: string | null;
  topicName: string | null;
};

const PRIORITY_ORDER = sql`case ${tasks.priority} when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end`;

function selectRows(where: SQL | undefined, order: SQL[]) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      notes: tasks.notes,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
      estimateMinutes: tasks.estimateMinutes,
      completedAt: tasks.completedAt,
      goalId: tasks.goalId,
      subjectId: tasks.subjectId,
      topicId: tasks.topicId,
      goalTitle: goals.title,
      subjectName: subjects.name,
      topicName: topics.name,
    })
    .from(tasks)
    .leftJoin(goals, eq(goals.id, tasks.goalId))
    .leftJoin(subjects, eq(subjects.id, tasks.subjectId))
    .leftJoin(topics, eq(topics.id, tasks.topicId))
    .where(where)
    .orderBy(...order)
    .limit(500)
    .then((rows) => rows.map((r) => ({ ...r, completed: r.completedAt != null })));
}

export type TaskFilter = "today" | "upcoming" | "someday" | "completed";

export async function listTasks(userId: string, filter: TaskFilter, today: LocalDate): Promise<TaskRowData[]> {
  const mine = eq(tasks.userId, userId);
  switch (filter) {
    case "today":
      return listTasksForDay(userId, today);
    case "upcoming":
      return selectRows(and(mine, isNull(tasks.completedAt), gt(tasks.dueDate, today)), [asc(tasks.dueDate), PRIORITY_ORDER, asc(tasks.createdAt)]);
    case "someday":
      return selectRows(and(mine, isNull(tasks.completedAt), isNull(tasks.dueDate)), [PRIORITY_ORDER, asc(tasks.createdAt)]);
    case "completed":
      return selectRows(and(mine, isNotNull(tasks.completedAt)), [desc(tasks.completedAt)]);
  }
}

/**
 * Open tasks due today or earlier (overdue first), plus tasks completed today so
 * ticking one off doesn't make it vanish.
 */
export async function listTasksForDay(userId: string, today: LocalDate): Promise<TaskRowData[]> {
  const { timezone: timeZone } = await getSettings(userId);
  const dayStart = startOfLocalDay(today, timeZone);
  const dayEnd = startOfLocalDay(addLocalDays(today, 1), timeZone);
  return selectRows(
    and(
      eq(tasks.userId, userId),
      or(
        and(isNull(tasks.completedAt), lte(tasks.dueDate, today)),
        and(gte(tasks.completedAt, dayStart), sql`${tasks.completedAt} < ${dayEnd}`),
      ),
    ),
    [sql`${tasks.completedAt} is not null`, asc(tasks.dueDate), PRIORITY_ORDER, asc(tasks.createdAt)],
  );
}

export async function listTasksForGoal(userId: string, goalId: string): Promise<TaskRowData[]> {
  return selectRows(and(eq(tasks.userId, userId), eq(tasks.goalId, goalId)), [sql`${tasks.completedAt} is not null`, asc(tasks.dueDate), PRIORITY_ORDER]);
}

export async function countTasks(userId: string): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(eq(tasks.userId, userId));
  return n;
}

export type TaskInput = {
  title: string;
  notes?: string | null;
  dueDate?: LocalDate | null;
  priority: Priority;
  goalId?: string | null;
  subjectId?: string | null;
  topicId?: string | null;
  estimateMinutes?: number | null;
};

/** Ensures every referenced goal / subject / topic belongs to this user and fits together. */
async function resolveLinks(userId: string, input: TaskInput) {
  const goalId = input.goalId || null;
  let subjectId = input.subjectId || null;
  const topicId = input.topicId || null;
  if (goalId) {
    const g = await db.query.goals.findFirst({ where: and(eq(goals.id, goalId), eq(goals.userId, userId)), columns: { id: true } });
    if (!g) throw new UserFacingError("That goal no longer exists.", { goalId: "Choose another goal" });
  }
  if (topicId) {
    const t = await db.query.topics.findFirst({ where: and(eq(topics.id, topicId), eq(topics.userId, userId)), columns: { subjectId: true } });
    if (!t) throw new UserFacingError("That topic no longer exists.", { topicId: "Choose another topic" });
    if (subjectId && subjectId !== t.subjectId) throw new UserFacingError("That topic belongs to a different subject.", { topicId: "Pick a topic from the chosen subject" });
    subjectId = t.subjectId;
  }
  if (subjectId) {
    const s = await db.query.subjects.findFirst({ where: and(eq(subjects.id, subjectId), eq(subjects.userId, userId)), columns: { id: true } });
    if (!s) throw new UserFacingError("That subject no longer exists.", { subjectId: "Choose another subject" });
  }
  return { goalId, subjectId, topicId };
}

function clean(input: TaskInput) {
  return {
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    dueDate: input.dueDate || null,
    priority: input.priority,
    estimateMinutes: input.estimateMinutes ?? null,
  };
}

export async function createTask(userId: string, input: TaskInput): Promise<Task> {
  const links = await resolveLinks(userId, input);
  const [row] = await db
    .insert(tasks)
    .values({ userId, ...clean(input), ...links })
    .returning();
  return row;
}

export async function updateTask(userId: string, id: string, input: TaskInput): Promise<Task> {
  const links = await resolveLinks(userId, input);
  const [row] = await db
    .update(tasks)
    .set({ ...clean(input), ...links })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning();
  if (!row) throw new NotFoundError("That task");
  return row;
}

/** Idempotent: completing an already completed task keeps its original timestamp. */
export async function setTaskDone(userId: string, id: string, done: boolean): Promise<void> {
  const res = await db
    .update(tasks)
    .set({ completedAt: done ? sql`coalesce(${tasks.completedAt}, now())` : null })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });
  if (!res.length) throw new NotFoundError("That task");
}

export async function deleteTask(userId: string, id: string): Promise<Task> {
  const [row] = await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).returning();
  if (!row) throw new NotFoundError("That task");
  return row;
}

export type TaskPickerOptions = {
  goals: Array<{ id: string; title: string }>;
  subjects: Array<{ id: string; name: string; topics: Array<{ id: string; name: string }> }>;
};

export async function getTaskPickerOptions(userId: string): Promise<TaskPickerOptions> {
  const [goalRows, subjectRows, topicRows] = await Promise.all([
    db
      .select({ id: goals.id, title: goals.title })
      .from(goals)
      .where(and(eq(goals.userId, userId), or(eq(goals.status, "active"), eq(goals.status, "paused"))))
      .orderBy(asc(goals.createdAt)),
    db
      .select({ id: subjects.id, name: subjects.name })
      .from(subjects)
      .where(and(eq(subjects.userId, userId), isNull(subjects.archivedAt)))
      .orderBy(asc(subjects.position), asc(subjects.name)),
    db
      .select({ id: topics.id, name: topics.name, subjectId: topics.subjectId })
      .from(topics)
      .where(eq(topics.userId, userId))
      .orderBy(asc(topics.position), asc(topics.name)),
  ]);
  return {
    goals: goalRows,
    subjects: subjectRows.map((s) => ({ ...s, topics: topicRows.filter((t) => t.subjectId === s.id).map(({ id, name }) => ({ id, name })) })),
  };
}

/** One task with its joined goal/subject/topic names (for API responses). */
export async function getTaskRow(userId: string, id: string): Promise<TaskRowData> {
  const [row] = await selectRows(and(eq(tasks.userId, userId), eq(tasks.id, id)), [asc(tasks.createdAt)]);
  if (!row) throw new NotFoundError("That task");
  return row;
}
