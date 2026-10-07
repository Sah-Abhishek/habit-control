/**
 * Calendar-day helpers. A "LocalDate" is an ISO `YYYY-MM-DD` string that names a
 * day in the user's own timezone. We never derive it from server time directly.
 */
import { TZDate } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export type LocalDate = string;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): value is LocalDate {
  if (!LOCAL_DATE_RE.test(value)) return false;
  const d = parseISO(value);
  return !Number.isNaN(d.getTime()) && format(d, "yyyy-MM-dd") === value;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar day it currently is (or was at `at`) for someone in `timeZone`. */
export function localDateIn(timeZone: string, at: Date = new Date()): LocalDate {
  return format(new TZDate(at.getTime(), timeZone), "yyyy-MM-dd");
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

export function diffLocalDays(later: LocalDate, earlier: LocalDate): number {
  return differenceInCalendarDays(parseISO(later), parseISO(earlier));
}

/** Inclusive list of days from `start` to `end`. Empty if end < start. */
export function eachLocalDay(start: LocalDate, end: LocalDate): LocalDate[] {
  const n = diffLocalDays(end, start);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addLocalDays(start, i));
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(date: LocalDate): number {
  return parseISO(date).getDay();
}

export function startOfWeek(date: LocalDate, weekStartsOn: number): LocalDate {
  const offset = (dayOfWeek(date) - weekStartsOn + 7) % 7;
  return addLocalDays(date, -offset);
}

/** Hours since local midnight (fractional) for an instant, in `timeZone`. */
export function hourOfDayIn(timeZone: string, at: Date): number {
  const z = new TZDate(at.getTime(), timeZone);
  return z.getHours() + z.getMinutes() / 60 + z.getSeconds() / 3600;
}

/** UTC instant of local midnight starting `date` in `timeZone`. */
export function startOfLocalDay(date: LocalDate, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, timeZone).getTime());
}

export function formatLocalDate(date: LocalDate, pattern: string): string {
  return format(parseISO(date), pattern);
}
