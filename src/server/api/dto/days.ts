import "server-only";
import type { LocalDate } from "@/domain/dates";
import type { Day } from "@/server/services/days";
import { focusLabelFor, toCheckInValues } from "@/server/services/today";

export function sleepDto(day: Day | null, timeZone: string) {
  const v = toCheckInValues(day, timeZone);
  if (!v.bed || !v.wake || v.sleepMinutes == null) return null;
  return { bed: v.bed, wake: v.wake, quality: v.sleepQuality, hours: Math.round((v.sleepMinutes / 60) * 100) / 100 };
}

export function checkInDto(day: Day | null, timeZone: string) {
  return { mood: day?.mood ?? null, energy: day?.energy ?? null, stress: day?.stress ?? null, note: day?.note ?? null, sleep: sleepDto(day, timeZone) };
}

export async function dayEntryDto(userId: string, date: LocalDate, day: Day | null, timeZone: string) {
  return {
    date,
    ...checkInDto(day, timeZone),
    focus: { topicId: day?.focusTopicId ?? null, text: day?.focusText ?? null, label: await focusLabelFor(userId, day) },
  };
}
