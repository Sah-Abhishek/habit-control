import { apiRoute, ok, readParam } from "@/server/api/handler";
import { dayEntryDto } from "@/server/api/dto/days";
import { sessionDto } from "@/server/api/dto/study";
import { localDate } from "@/server/schemas/common";
import { habitStatesOn, tasksCompletedOn } from "@/server/services/calendar";
import { getDay } from "@/server/services/days";
import { listSessionsInRange } from "@/server/services/study";
import { accountStartDate, aggregateDays } from "@/server/services/today";

export const GET = apiRoute<{ date: string }>(async ({ userId, today, settings }, params) => {
  const date = readParam(params.date, localDate);
  const tz = settings.timezone;
  const accountStart = await accountStartDate(userId, tz);
  const [[agg], sessions, habits, done, day] = await Promise.all([
    aggregateDays(userId, date, date, { today, timeZone: tz, studyTargetMin: settings.dailyStudyTargetMin, accountCreated: accountStart }),
    listSessionsInRange(userId, date, date),
    habitStatesOn(userId, date, today, tz),
    tasksCompletedOn(userId, date, tz),
    getDay(userId, date),
  ]);
  return ok({
    date,
    score: agg?.score ?? null,
    studySeconds: agg?.studySeconds ?? 0,
    sessions: sessions.map(sessionDto),
    habits,
    tasksCompleted: done,
    entry: await dayEntryDto(userId, date, day, tz),
  });
});
