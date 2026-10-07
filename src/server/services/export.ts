import "server-only";
import { and, asc, eq, getTableColumns, notInArray } from "drizzle-orm";
import { db } from "@/server/db";
import { days, goals, habitLogs, habits, milestones, revisions, studySessions, subjects, tasks, topics, user, userSettings } from "@/server/db/schema";

/** Hard cap per table so a runaway account can't exhaust server memory. */
export const EXPORT_ROW_LIMIT = 50_000;

export const CSV_TABLES = ["habits", "habit_logs", "study_sessions", "tasks", "days", "goals", "milestones", "subjects", "topics", "revisions"] as const;
export type CsvTable = (typeof CSV_TABLES)[number];

type Row = Record<string, unknown>;

async function sensitiveHabitIds(userId: string): Promise<string[]> {
  const rows = await db.select({ id: habits.id }).from(habits).where(and(eq(habits.userId, userId), eq(habits.isSensitive, true)));
  return rows.map((r) => r.id);
}

/** Rows for one table, always scoped to the user. Auth secrets are never selectable here. */
export async function exportTable(userId: string, table: CsvTable, includeSensitive: boolean): Promise<Row[]> {
  const hidden = includeSensitive ? [] : await sensitiveHabitIds(userId);
  const limit = EXPORT_ROW_LIMIT;
  switch (table) {
    case "habits":
      return db
        .select()
        .from(habits)
        .where(hidden.length ? and(eq(habits.userId, userId), notInArray(habits.id, hidden)) : eq(habits.userId, userId))
        .orderBy(asc(habits.position))
        .limit(limit);
    case "habit_logs":
      return db
        .select({ id: habitLogs.id, habitId: habitLogs.habitId, habit: habits.name, localDate: habitLogs.localDate, value: habitLogs.value, note: habitLogs.note, createdAt: habitLogs.createdAt, updatedAt: habitLogs.updatedAt })
        .from(habitLogs)
        .innerJoin(habits, eq(habits.id, habitLogs.habitId))
        .where(hidden.length ? and(eq(habitLogs.userId, userId), notInArray(habitLogs.habitId, hidden)) : eq(habitLogs.userId, userId))
        .orderBy(asc(habitLogs.localDate))
        .limit(limit);
    case "study_sessions":
      return db.select().from(studySessions).where(eq(studySessions.userId, userId)).orderBy(asc(studySessions.startedAt)).limit(limit);
    case "tasks":
      return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(asc(tasks.createdAt)).limit(limit);
    case "days":
      return db.select().from(days).where(eq(days.userId, userId)).orderBy(asc(days.localDate)).limit(limit);
    case "goals":
      return db.select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.createdAt)).limit(limit);
    case "milestones":
      return db.select().from(milestones).where(eq(milestones.userId, userId)).orderBy(asc(milestones.goalId), asc(milestones.position)).limit(limit);
    case "subjects":
      return db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(asc(subjects.position)).limit(limit);
    case "topics":
      return db.select().from(topics).where(eq(topics.userId, userId)).orderBy(asc(topics.subjectId), asc(topics.position)).limit(limit);
    case "revisions":
      return db.select().from(revisions).where(eq(revisions.userId, userId)).orderBy(asc(revisions.dueDate)).limit(limit);
  }
}

/** Everything we hold about the user, grouped by table. */
export async function exportAll(userId: string, includeSensitive: boolean) {
  const [profile] = await db
    .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, userId));
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  const tables = Object.fromEntries(await Promise.all(CSV_TABLES.map(async (t) => [t, await exportTable(userId, t, includeSensitive)] as const))) as Record<CsvTable, Row[]>;
  return {
    exportedAt: new Date().toISOString(),
    format: "almanac-export-v1",
    includesSensitive: includeSensitive,
    profile: profile ?? null,
    settings: settings ?? null,
    ...tables,
  };
}

/** Prevents spreadsheet formula injection when a cell starts with = + - @ (or tab/CR). */
function neutralise(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function cell(value: unknown): string {
  if (value == null) return "";
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (Array.isArray(value)) s = value.join(";");
  else if (typeof value === "object") s = JSON.stringify(value);
  else s = String(value);
  // Numbers are safe as-is (a negative number is data, not a formula).
  if (typeof value !== "number") s = neutralise(s);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[], columns?: string[]): string {
  const cols = columns ?? (rows.length ? Object.keys(rows[0]) : []);
  const lines = [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))];
  // BOM so Excel opens UTF-8 (emoji, non-Latin names) correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Column headers even for an empty table, so the file is still useful. */
export function columnsFor(table: CsvTable): string[] {
  const t = { habits, habit_logs: habitLogs, study_sessions: studySessions, tasks, days, goals, milestones, subjects, topics, revisions }[table];
  if (table === "habit_logs") return ["id", "habitId", "habit", "localDate", "value", "note", "createdAt", "updatedAt"];
  return Object.keys(getTableColumns(t));
}
