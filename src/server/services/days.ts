import "server-only";
import { TZDate } from "@date-fns/tz";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { addLocalDays, diffLocalDays, type LocalDate } from "@/domain/dates";
import { db } from "@/server/db";
import { days, topics } from "@/server/db/schema";
import { UserFacingError } from "@/server/result";

export type Day = typeof days.$inferSelect;

/** Latest edit allowed for a past day — keeps the journal honest but forgiving. */
const MAX_PAST_DAYS = 365;
const MAX_SLEEP_HOURS = 16;

function assertEditable(date: LocalDate, today: LocalDate) {
  if (diffLocalDays(date, today) > 0) throw new UserFacingError("You can’t log a day that hasn’t happened yet.");
  if (diffLocalDays(today, date) > MAX_PAST_DAYS) throw new UserFacingError("You can only edit the last 12 months.");
}

export async function getDay(userId: string, date: LocalDate): Promise<Day | null> {
  const row = await db.query.days.findFirst({ where: and(eq(days.userId, userId), eq(days.localDate, date)) });
  return row ?? null;
}

export async function getDaysInRange(userId: string, start: LocalDate, end: LocalDate): Promise<Day[]> {
  return db.query.days.findMany({
    where: and(eq(days.userId, userId), gte(days.localDate, start), lte(days.localDate, end)),
    orderBy: [asc(days.localDate)],
  });
}

type DayPatch = Partial<Pick<Day, "mood" | "energy" | "stress" | "note" | "sleepStart" | "sleepEnd" | "sleepQuality" | "focusTopicId" | "focusText">>;

/** Idempotent partial upsert on (user, day): only the given fields change. */
async function upsertDay(userId: string, date: LocalDate, patch: DayPatch): Promise<Day> {
  const [row] = await db
    .insert(days)
    .values({ userId, localDate: date, ...patch })
    .onConflictDoUpdate({ target: [days.userId, days.localDate], set: { ...patch, updatedAt: new Date() } })
    .returning();
  return row;
}

export type CheckInPatch = { mood?: number | null; energy?: number | null; stress?: number | null; note?: string | null };

export async function saveCheckIn(userId: string, date: LocalDate, patch: CheckInPatch, today: LocalDate): Promise<Day> {
  assertEditable(date, today);
  const clean: DayPatch = {};
  if (patch.mood !== undefined) clean.mood = patch.mood;
  if (patch.energy !== undefined) clean.energy = patch.energy;
  if (patch.stress !== undefined) clean.stress = patch.stress;
  if (patch.note !== undefined) clean.note = patch.note?.trim() ? patch.note.trim() : null;
  if (!Object.keys(clean).length) throw new UserFacingError("Nothing to save.");
  return upsertDay(userId, date, clean);
}

/** "HH:mm" → minutes since midnight, or null when malformed. */
export function parseClock(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function instantAt(date: LocalDate, minutes: number, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(new TZDate(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60, 0, timeZone).getTime());
}

/**
 * Sleep logged on day D is the night that ended on the morning of D. A bed time
 * later in the clock than the wake time means it was the evening before (23:40 →
 * 07:10); an earlier one means after midnight (00:40 → 07:20). Resolved in the
 * user's timezone, so DST nights are measured correctly.
 */
export function resolveSleepWindow(date: LocalDate, bed: string, wake: string, timeZone: string): { start: Date; end: Date } {
  const bedMin = parseClock(bed);
  const wakeMin = parseClock(wake);
  if (bedMin == null) throw new UserFacingError("Enter bed time as HH:MM.", { bed: "Use HH:MM, e.g. 23:30" });
  if (wakeMin == null) throw new UserFacingError("Enter wake time as HH:MM.", { wake: "Use HH:MM, e.g. 07:00" });
  if (bedMin === wakeMin) throw new UserFacingError("Bed and wake time are the same.", { wake: "Wake time must differ from bed time" });
  const bedDate = bedMin > wakeMin ? addLocalDays(date, -1) : date;
  const start = instantAt(bedDate, bedMin, timeZone);
  const end = instantAt(date, wakeMin, timeZone);
  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  if (hours <= 0) throw new UserFacingError("Wake time must be after bed time.", { wake: "Wake time must be after bed time" });
  if (hours > MAX_SLEEP_HOURS) throw new UserFacingError(`That’s more than ${MAX_SLEEP_HOURS} hours — check the times.`, { bed: "Check this time" });
  return { start, end };
}

export async function saveSleep(
  userId: string,
  date: LocalDate,
  input: { bed: string; wake: string; quality?: number | null },
  timeZone: string,
  today: LocalDate,
): Promise<Day> {
  assertEditable(date, today);
  const { start, end } = resolveSleepWindow(date, input.bed, input.wake, timeZone);
  if (end.getTime() > Date.now() + 60_000) throw new UserFacingError("Wake time is in the future.", { wake: "That time hasn’t happened yet" });
  return upsertDay(userId, date, { sleepStart: start, sleepEnd: end, sleepQuality: input.quality ?? null });
}

export async function clearSleep(userId: string, date: LocalDate, today: LocalDate): Promise<void> {
  assertEditable(date, today);
  await db.update(days).set({ sleepStart: null, sleepEnd: null, sleepQuality: null }).where(and(eq(days.userId, userId), eq(days.localDate, date)));
}

export async function saveFocus(userId: string, date: LocalDate, input: { topicId: string | null; text: string | null }, today: LocalDate): Promise<Day> {
  assertEditable(date, today);
  if (input.topicId) {
    const t = await db.query.topics.findFirst({ where: and(eq(topics.id, input.topicId), eq(topics.userId, userId)), columns: { id: true } });
    if (!t) throw new UserFacingError("That topic no longer exists.", { topicId: "Choose another topic" });
  }
  const text = input.text?.trim() || null;
  return upsertDay(userId, date, { focusTopicId: input.topicId, focusText: text });
}
