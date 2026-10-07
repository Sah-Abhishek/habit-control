// Goals, milestones and pace for the Goals pages and the Today card.
import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { diffLocalDays, type LocalDate } from "@/domain/dates";
import {
  daysLeft,
  estimatedFinish,
  expectedProgress,
  goalProgress,
  neededPerWeek,
  paceStatus,
  velocityPerWeek,
  type PaceStatus,
} from "@/domain/goals";
import { db, type Tx } from "@/server/db";
import { goals, habits, milestones, subjects, topics } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/result";

export type Goal = typeof goals.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type GoalStatus = Goal["status"];

/** Lightweight list for "link to goal" pickers. */
export async function listGoalOptions(userId: string): Promise<Array<{ id: string; title: string }>> {
  return db
    .select({ id: goals.id, title: goals.title })
    .from(goals)
    .where(and(eq(goals.userId, userId), inArray(goals.status, ["active", "paused"])))
    .orderBy(asc(goals.createdAt));
}

export type GoalMetrics = {
  progress: number;
  expected: number | null;
  status: PaceStatus | null;
  daysLeft: number | null;
  velocity: number | null;
  needed: number | null;
  estFinish: LocalDate | null;
};

export function goalMetrics(goal: Pick<Goal, "startDate" | "targetDate">, ms: ReadonlyArray<{ progress: number }>, today: LocalDate): GoalMetrics {
  const progress = goalProgress(ms);
  const expected = expectedProgress(goal.startDate, goal.targetDate, today);
  return {
    progress,
    expected,
    status: paceStatus(progress, expected),
    daysLeft: daysLeft(goal.targetDate, today),
    velocity: velocityPerWeek(progress, goal.startDate, today),
    needed: neededPerWeek(progress, goal.targetDate, today),
    estFinish: estimatedFinish(progress, goal.startDate, today),
  };
}

async function milestonesFor(userId: string, goalIds: string[]): Promise<Map<string, Milestone[]>> {
  const out = new Map<string, Milestone[]>(goalIds.map((id) => [id, []]));
  if (!goalIds.length) return out;
  const rows = await db.query.milestones.findMany({
    where: and(eq(milestones.userId, userId), inArray(milestones.goalId, goalIds)),
    orderBy: [asc(milestones.position), asc(milestones.createdAt)],
  });
  for (const m of rows) out.get(m.goalId)?.push(m);
  return out;
}

export type GoalCard = { goal: Goal; milestoneCount: number; completedMilestones: number; metrics: GoalMetrics };

export async function listGoalCards(userId: string, today: LocalDate): Promise<GoalCard[]> {
  const list = await db.query.goals.findMany({
    where: eq(goals.userId, userId),
    orderBy: [desc(goals.isPrimary), asc(goals.createdAt)],
  });
  const ms = await milestonesFor(
    userId,
    list.map((g) => g.id),
  );
  return list.map((goal) => {
    const m = ms.get(goal.id) ?? [];
    return { goal, milestoneCount: m.length, completedMilestones: m.filter((x) => x.completedAt).length, metrics: goalMetrics(goal, m, today) };
  });
}

export async function getGoal(userId: string, id: string): Promise<Goal> {
  const g = await db.query.goals.findFirst({ where: and(eq(goals.id, id), eq(goals.userId, userId)) });
  if (!g) throw new NotFoundError("That goal");
  return g;
}

export type GoalDetail = {
  goal: Goal;
  milestones: Milestone[];
  metrics: GoalMetrics;
  subjects: Array<{ id: string; name: string; progress: number | null; topicCount: number }>;
  habits: Array<{ id: string; name: string; kind: "build" | "reduce" }>;
};

export async function getGoalDetail(userId: string, id: string, today: LocalDate): Promise<GoalDetail> {
  const goal = await getGoal(userId, id);
  const [ms, subjectRows, habitRows] = await Promise.all([
    milestonesFor(userId, [goal.id]).then((m) => m.get(goal.id) ?? []),
    db
      .select({
        id: subjects.id,
        name: subjects.name,
        progress: sql<number | null>`avg(${topics.progress})`.mapWith((v) => (v == null ? null : Number(v))),
        topicCount: sql<number>`count(${topics.id})`.mapWith(Number),
      })
      .from(subjects)
      .leftJoin(topics, eq(topics.subjectId, subjects.id))
      .where(and(eq(subjects.userId, userId), eq(subjects.goalId, goal.id), isNull(subjects.archivedAt)))
      .groupBy(subjects.id)
      .orderBy(asc(subjects.position), asc(subjects.name)),
    db
      .select({ id: habits.id, name: habits.name, kind: habits.kind })
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.goalId, goal.id), isNull(habits.archivedAt)))
      .orderBy(asc(habits.position)),
  ]);
  return { goal, milestones: ms, metrics: goalMetrics(goal, ms, today), subjects: subjectRows, habits: habitRows };
}

export type GoalInput = {
  title: string;
  description?: string | null;
  startDate: LocalDate;
  targetDate?: LocalDate | null;
  isPrimary: boolean;
};

function validateDates(input: GoalInput) {
  if (input.targetDate && diffLocalDays(input.targetDate, input.startDate) < 0) {
    throw new UserFacingError("The target date is before the start date.", { targetDate: "Pick a date on or after the start date" });
  }
}

/**
 * Serialises "main goal" changes per user so two tabs can't both clear and set the
 * primary flag at once (the unique partial index is the final guard).
 */
async function lockUserGoals(tx: Tx, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"goals-primary:" + userId}))`);
}

export async function createGoal(userId: string, input: GoalInput): Promise<Goal> {
  validateDates(input);
  return db.transaction(async (tx) => {
    await lockUserGoals(tx, userId);
    if (input.isPrimary) await tx.update(goals).set({ isPrimary: false }).where(and(eq(goals.userId, userId), eq(goals.isPrimary, true)));
    const [row] = await tx
      .insert(goals)
      .values({
        userId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        startDate: input.startDate,
        targetDate: input.targetDate || null,
        isPrimary: input.isPrimary,
      })
      .returning();
    return row;
  });
}

export async function updateGoal(userId: string, id: string, input: GoalInput): Promise<Goal> {
  validateDates(input);
  return db.transaction(async (tx) => {
    await lockUserGoals(tx, userId);
    const existing = await tx.query.goals.findFirst({ where: and(eq(goals.id, id), eq(goals.userId, userId)) });
    if (!existing) throw new NotFoundError("That goal");
    const canBePrimary = existing.status === "active" || existing.status === "paused";
    if (input.isPrimary && !canBePrimary) throw new UserFacingError("Only active or paused goals can be your main goal.");
    if (input.isPrimary) await tx.update(goals).set({ isPrimary: false }).where(and(eq(goals.userId, userId), eq(goals.isPrimary, true)));
    const [row] = await tx
      .update(goals)
      .set({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        startDate: input.startDate,
        targetDate: input.targetDate || null,
        isPrimary: input.isPrimary,
      })
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning();
    return row;
  });
}

export async function setPrimaryGoal(userId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await lockUserGoals(tx, userId);
    const existing = await tx.query.goals.findFirst({ where: and(eq(goals.id, id), eq(goals.userId, userId)) });
    if (!existing) throw new NotFoundError("That goal");
    if (existing.status === "completed" || existing.status === "archived") throw new UserFacingError("Only active or paused goals can be your main goal.");
    await tx.update(goals).set({ isPrimary: false }).where(and(eq(goals.userId, userId), eq(goals.isPrimary, true)));
    await tx.update(goals).set({ isPrimary: true }).where(eq(goals.id, id));
  });
}

export async function setGoalStatus(userId: string, id: string, status: GoalStatus): Promise<GoalStatus> {
  const previous = await getGoal(userId, id);
  const done = status === "completed" || status === "archived";
  await db
    .update(goals)
    .set({ status, ...(done ? { isPrimary: false } : {}) })
    .where(and(eq(goals.id, id), eq(goals.userId, userId)));
  return previous.status;
}

/** Permanently deletes the goal and its milestones. Linked subjects/habits/tasks are kept but unlinked. */
export async function deleteGoal(userId: string, id: string): Promise<void> {
  const res = await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId))).returning({ id: goals.id });
  if (!res.length) throw new NotFoundError("That goal");
}

/* ------------------------------ Milestones ------------------------------ */

export type MilestoneInput = { title: string; targetDate?: LocalDate | null; progress: number };

export async function getMilestone(userId: string, id: string): Promise<Milestone> {
  const m = await db.query.milestones.findFirst({ where: and(eq(milestones.id, id), eq(milestones.userId, userId)) });
  if (!m) throw new NotFoundError("That milestone");
  return m;
}

export async function createMilestone(userId: string, goalId: string, input: MilestoneInput): Promise<Milestone> {
  await getGoal(userId, goalId);
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${milestones.position}), -1) + 1` })
    .from(milestones)
    .where(eq(milestones.goalId, goalId));
  const progress = Math.round(Math.max(0, Math.min(100, input.progress)));
  const [row] = await db
    .insert(milestones)
    .values({
      userId,
      goalId,
      title: input.title.trim(),
      targetDate: input.targetDate || null,
      progress,
      position: Number(next),
      completedAt: progress >= 100 ? new Date() : null,
    })
    .returning();
  return row;
}

export async function updateMilestone(userId: string, id: string, input: MilestoneInput): Promise<Milestone> {
  const existing = await getMilestone(userId, id);
  const progress = Math.round(Math.max(0, Math.min(100, input.progress)));
  const [row] = await db
    .update(milestones)
    .set({
      title: input.title.trim(),
      targetDate: input.targetDate || null,
      progress,
      // Reaching 100% completes it; dropping below re-opens it. Keep the original timestamp if already complete.
      completedAt: progress >= 100 ? (existing.completedAt ?? new Date()) : null,
    })
    .where(and(eq(milestones.id, id), eq(milestones.userId, userId)))
    .returning();
  return row;
}

/** Idempotent: completing sets progress to 100; re-opening keeps the progress below 100. */
export async function setMilestoneComplete(userId: string, id: string, complete: boolean): Promise<{ previousProgress: number }> {
  const existing = await getMilestone(userId, id);
  await db
    .update(milestones)
    .set(complete ? { progress: 100, completedAt: existing.completedAt ?? new Date() } : { completedAt: null, progress: existing.progress >= 100 ? 90 : existing.progress })
    .where(and(eq(milestones.id, id), eq(milestones.userId, userId)));
  return { previousProgress: existing.progress };
}

export async function deleteMilestone(userId: string, id: string): Promise<{ goalId: string }> {
  const res = await db
    .delete(milestones)
    .where(and(eq(milestones.id, id), eq(milestones.userId, userId)))
    .returning({ goalId: milestones.goalId });
  if (!res.length) throw new NotFoundError("That milestone");
  return res[0];
}

/** Swaps the milestone with its neighbour. Positions are renumbered so gaps or ties never stick. */
export async function moveMilestone(userId: string, id: string, direction: "up" | "down"): Promise<{ goalId: string }> {
  const m = await getMilestone(userId, id);
  await db.transaction(async (tx) => {
    const siblings = await tx
      .select({ id: milestones.id })
      .from(milestones)
      .where(and(eq(milestones.goalId, m.goalId), eq(milestones.userId, userId)))
      .orderBy(asc(milestones.position), asc(milestones.createdAt))
      .for("update");
    const ids = siblings.map((s) => s.id);
    const i = ids.indexOf(id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    for (let k = 0; k < ids.length; k++) await tx.update(milestones).set({ position: k }).where(eq(milestones.id, ids[k]));
  });
  return { goalId: m.goalId };
}

/* ------------------------------ Today card ------------------------------ */

export type PrimaryGoalSummary = {
  id: string;
  title: string;
  progress: number;
  targetDate: string | null;
  daysLeft: number | null;
  expected: number | null;
  status: "ahead" | "on_pace" | "behind" | null;
  estFinish: string | null;
  milestones: Array<{ id: string; title: string; progress: number; completed: boolean }>;
};

/** The main goal (or most recently created active goal) for the Today screen. */
export async function getPrimaryGoalSummary(userId: string, today: LocalDate): Promise<PrimaryGoalSummary | null> {
  const goal =
    (await db.query.goals.findFirst({ where: and(eq(goals.userId, userId), eq(goals.isPrimary, true)) })) ??
    (await db.query.goals.findFirst({ where: and(eq(goals.userId, userId), eq(goals.status, "active")), orderBy: [desc(goals.createdAt)] }));
  if (!goal) return null;
  const ms = (await milestonesFor(userId, [goal.id])).get(goal.id) ?? [];
  const m = goalMetrics(goal, ms, today);
  return {
    id: goal.id,
    title: goal.title,
    progress: m.progress,
    targetDate: goal.targetDate,
    daysLeft: m.daysLeft,
    expected: m.expected,
    status: m.status,
    estFinish: m.estFinish,
    milestones: ms.map((x) => ({ id: x.id, title: x.title, progress: x.progress, completed: !!x.completedAt })),
  };
}

/** A single goal as a list card (API responses after create/update). */
export async function getGoalCard(userId: string, id: string, today: LocalDate): Promise<GoalCard> {
  const goal = await getGoal(userId, id);
  const m = (await milestonesFor(userId, [goal.id])).get(goal.id) ?? [];
  return { goal, milestoneCount: m.length, completedMilestones: m.filter((x) => x.completedAt).length, metrics: goalMetrics(goal, m, today) };
}
