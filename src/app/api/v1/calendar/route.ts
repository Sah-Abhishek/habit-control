import { z } from "zod";
import { diffLocalDays, type LocalDate } from "@/domain/dates";
import { apiRoute, ok, readQuery } from "@/server/api/handler";
import { accountStartDate, aggregateDays } from "@/server/services/today";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");

function monthEnd(month: string): LocalDate {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

export const GET = apiRoute(async ({ req, userId, today, settings }) => {
  const { month } = readQuery(req, z.object({ month: monthSchema.default(today.slice(0, 7)) }));
  const start = `${month}-01`;
  const end = monthEnd(month);
  const tz = settings.timezone;
  const accountStart = await accountStartDate(userId, tz);
  const aggs = await aggregateDays(userId, start, end, { today, timeZone: tz, studyTargetMin: settings.dailyStudyTargetMin, accountCreated: accountStart });
  return ok({
    month,
    weekStartsOn: settings.weekStartsOn,
    today,
    days: aggs.map((a) => ({
      date: a.date,
      score: a.score,
      studySeconds: a.studySeconds,
      studyTargetHit: a.studyTargetMet,
      habitsOnTrack: a.habitsSucceeded,
      habitsScheduled: a.habitsScheduled,
      tasksCompleted: a.tasksCompleted,
      reduceOver: a.reduceOver,
      future: a.isFuture,
      beforeAccount: diffLocalDays(a.date, accountStart) < 0,
    })),
  });
});

