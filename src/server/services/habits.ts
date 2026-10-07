import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { addLocalDays, diffLocalDays, type LocalDate } from "@/domain/dates";
import {
  bestStreak,
  consistency,
  currentStreak,
  dayState,
  reductionStats,
  thread,
  type HabitDef,
  type HabitLogMap,
} from "@/domain/habits";
import { db } from "@/server/db";
import { goals, habitLogs, habits } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/result";

export type Habit = typeof habits.$inferSelect;

export type HabitInput = {
  name: string;
  kind: "build" | "reduce";
  tracking: "binary" | "quantity" | "duration" | "numeric";
  target: number;
  unit?: string | null;
  scheduleDays: number[];
  baseline?: number | null;
  isSensitive: boolean;
  goalId?: string | null;
};

export function toDef(h: Habit): HabitDef {
  return { kind: h.kind, target: h.target, scheduleDays: h.scheduleDays, startedOn: h.startedOn, baseline: h.baseline };
}

async function assertGoalOwned(userId: string, goalId: string | null | undefined) {
  if (!goalId) return;
  const g = await db.query.goals.findFirst({ where: and(eq(goals.id, goalId), eq(goals.userId, userId)), columns: { id: true } });
  if (!g) throw new UserFacingError("That goal no longer exists.", { goalId: "Choose another goal" });
}

function normalise(input: HabitInput): HabitInput {
  // Binary habits are always "1 = done"; reduce habits are counted, never binary.
  const tracking = input.kind === "reduce" ? "quantity" : input.tracking;
  return {
    ...input,
    name: input.name.trim(),
    tracking,
    target: tracking === "binary" ? 1 : input.target,
    unit: input.unit?.trim() || null,
    baseline: input.kind === "reduce" ? (input.baseline ?? null) : null,
    scheduleDays: [...new Set(input.scheduleDays)].sort(),
  };
}

export async function listHabits(userId: string, opts: { includeArchived?: boolean } = {}): Promise<Habit[]> {
  return db.query.habits.findMany({
    where: opts.includeArchived ? eq(habits.userId, userId) : and(eq(habits.userId, userId), isNull(habits.archivedAt)),
    orderBy: [asc(habits.position), asc(habits.createdAt)],
  });
}

export async function getHabit(userId: string, id: string): Promise<Habit> {
  const h = await db.query.habits.findFirst({ where: and(eq(habits.id, id), eq(habits.userId, userId)) });
  if (!h) throw new NotFoundError("That habit");
  return h;
}

export async function createHabit(userId: string, input: HabitInput, today: LocalDate): Promise<Habit> {
  const data = normalise(input);
  await assertGoalOwned(userId, data.goalId);
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${habits.position}), -1) + 1` })
    .from(habits)
    .where(eq(habits.userId, userId));
  const [row] = await db
    .insert(habits)
    .values({ ...data, userId, position: Number(next), startedOn: today })
    .returning();
  return row;
}

export async function updateHabit(userId: string, id: string, input: HabitInput): Promise<Habit> {
  const data = normalise(input);
  await assertGoalOwned(userId, data.goalId);
  const [row] = await db
    .update(habits)
    .set(data)
    .where(and(eq(habits.id, id), eq(habits.userId, userId)))
    .returning();
  if (!row) throw new NotFoundError("That habit");
  return row;
}

export async function setHabitArchived(userId: string, id: string, archived: boolean): Promise<void> {
  const res = await db
    .update(habits)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(habits.id, id), eq(habits.userId, userId)))
    .returning({ id: habits.id });
  if (!res.length) throw new NotFoundError("That habit");
}

/** Permanently deletes the habit and its history. */
export async function deleteHabit(userId: string, id: string): Promise<void> {
  const res = await db.delete(habits).where(and(eq(habits.id, id), eq(habits.userId, userId))).returning({ id: habits.id });
  if (!res.length) throw new NotFoundError("That habit");
}

export type LogMode = "set" | "increment";

/**
 * Records a value for one habit on one day. "increment" is atomic in the database,
 * so concurrent taps from two tabs both count; "set" is idempotent. A resulting
 * value of 0 for a build habit removes the row (un-ticking).
 */
export async function logHabit(
  userId: string,
  habitId: string,
  date: LocalDate,
  mode: LogMode,
  value: number,
  today: LocalDate,
): Promise<{ value: number; previous: number }> {
  if (diffLocalDays(date, today) > 0) throw new UserFacingError("You can’t log a day that hasn’t happened yet.");
  const habit = await getHabit(userId, habitId);
  if (habit.archivedAt) throw new UserFacingError("This habit is archived. Restore it to log again.");
  if (diffLocalDays(date, addLocalDays(today, -365)) < 0) throw new UserFacingError("You can only edit the last 12 months.");

  const where = and(eq(habitLogs.habitId, habitId), eq(habitLogs.localDate, date));
  return db.transaction(async (tx) => {
    // Lock the existing row (if any) so "previous" — used for Undo — is accurate.
    const [existing] = await tx.select({ value: habitLogs.value }).from(habitLogs).where(where).for("update");
    const previous = existing?.value ?? 0;
    const [row] = await tx
      .insert(habitLogs)
      .values({ userId, habitId, localDate: date, value: Math.max(0, value) })
      .onConflictDoUpdate({
        target: [habitLogs.habitId, habitLogs.localDate],
        set: {
          value: mode === "increment" ? sql`greatest(0, ${habitLogs.value} + ${value})` : sql`${Math.max(0, value)}`,
          updatedAt: new Date(),
        },
      })
      .returning({ value: habitLogs.value });
    // Zero means "nothing logged": keep the table free of empty rows.
    if (row.value === 0) await tx.delete(habitLogs).where(where);
    return { value: row.value, previous };
  });
}

export async function getLogMaps(userId: string, habitIds: string[], start: LocalDate, end: LocalDate): Promise<Map<string, Map<LocalDate, number>>> {
  const out = new Map<string, Map<LocalDate, number>>(habitIds.map((id) => [id, new Map()]));
  if (!habitIds.length) return out;
  const rows = await db
    .select({ habitId: habitLogs.habitId, localDate: habitLogs.localDate, value: habitLogs.value })
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), inArray(habitLogs.habitId, habitIds), gte(habitLogs.localDate, start), lte(habitLogs.localDate, end)));
  for (const r of rows) out.get(r.habitId)?.set(r.localDate, r.value);
  return out;
}

export type HabitSummary = {
  habit: Habit;
  todayValue: number;
  todayState: ReturnType<typeof dayState>;
  scheduledToday: boolean;
  c7: ReturnType<typeof consistency>;
  c30: ReturnType<typeof consistency>;
  c90: ReturnType<typeof consistency>;
  streak: number;
  best: number;
  trail7: ReturnType<typeof thread>;
  reduction: ReturnType<typeof reductionStats> | null;
};

/** Everything the Habits list and Today need, computed from one log query. */
export async function habitSummaries(userId: string, today: LocalDate, historyDays = 400): Promise<HabitSummary[]> {
  const list = await listHabits(userId);
  const start = addLocalDays(today, -historyDays);
  const maps = await getLogMaps(userId, list.map((h) => h.id), start, today);
  return list.map((habit) => summarise(habit, maps.get(habit.id) ?? new Map(), today));
}

export function summarise(habit: Habit, logs: HabitLogMap, today: LocalDate): HabitSummary {
  const def = toDef(habit);
  return {
    habit,
    todayValue: logs.get(today) ?? 0,
    todayState: dayState(def, logs, today, today),
    scheduledToday: dayState(def, logs, today, today) !== "off",
    c7: consistency(def, logs, today, 7),
    c30: consistency(def, logs, today, 30),
    c90: consistency(def, logs, today, 90),
    streak: currentStreak(def, logs, today),
    best: bestStreak(def, logs, today),
    trail7: thread(def, logs, today, 7),
    reduction: habit.kind === "reduce" ? reductionStats(def, logs, today) : null,
  };
}
