import "server-only";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { addLocalDays, diffLocalDays, localDateIn, type LocalDate } from "@/domain/dates";
import { dayState, type DayState } from "@/domain/habits";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { getLogMaps, listHabits, toDef } from "./habits";

/** Each habit's state on one day (archived habits only for days before archiving; off days omitted). */
export async function habitStatesOn(userId: string, date: LocalDate, today: LocalDate, timeZone: string): Promise<Array<{ id: string; name: string; state: DayState; value: number }>> {
  const list = await listHabits(userId, { includeArchived: true });
  const maps = await getLogMaps(userId, list.map((h) => h.id), date, date);
  const out: Array<{ id: string; name: string; state: DayState; value: number }> = [];
  for (const h of list) {
    if (h.archivedAt && diffLocalDays(date, localDateIn(timeZone, h.archivedAt)) >= 0) continue;
    const logs = maps.get(h.id) ?? new Map();
    const state = dayState(toDef(h), logs, date, today);
    if (state === "off" || state === "future") continue;
    out.push({ id: h.id, name: h.name, state, value: logs.get(date) ?? 0 });
  }
  return out;
}

/** Tasks whose completion instant falls on `date` in the user's timezone. */
export async function tasksCompletedOn(userId: string, date: LocalDate, timeZone: string): Promise<Array<{ id: string; title: string }>> {
  return db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        isNotNull(tasks.completedAt),
        gte(tasks.completedAt, new Date(`${addLocalDays(date, -1)}T00:00:00Z`)),
        lte(tasks.completedAt, new Date(`${addLocalDays(date, 2)}T00:00:00Z`)),
        sql`to_char(${tasks.completedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') = ${date}`,
      ),
    );
}
