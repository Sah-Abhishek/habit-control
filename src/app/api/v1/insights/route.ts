import { z } from "zod";
import { apiRoute, ok, readQuery } from "@/server/api/handler";
import { tickDto } from "@/server/api/dto/habits";
import { getInsights } from "@/server/services/insights";

export const GET = apiRoute(async ({ req, userId }) => {
  const { range } = readQuery(req, z.object({ range: z.enum(["7d", "30d", "90d", "1y"]).default("30d") }));
  const i = await getInsights(userId, range);
  const k = i.kpis;
  return ok({
    range: i.range,
    start: i.start,
    end: i.today,
    kpis: {
      studySeconds: k.totalSeconds,
      prevStudySeconds: k.totalChange == null && k.prevTotalSeconds === 0 ? null : k.prevTotalSeconds,
      avgDailySeconds: Math.round(k.avgSecondsPerDay),
      targetSeconds: i.targetSecondsPerDay,
      consistency: { days: k.studyDays, total: k.days },
      avgFocus: k.avgFocus,
      focusSessions: k.focusSessions,
      accuracy: k.accuracy,
      attempted: k.attempted,
      correct: k.correct,
      revisions: i.revisions,
    },
    weekly: i.weeks.map((w) => ({ weekStart: w.weekStart, seconds: w.seconds, partial: w.isCurrent })),
    weeklyTargetSeconds: i.targetSecondsPerDay * 7,
    habitThreads: i.threads.map((t) => ({ id: t.id, name: t.name, kind: t.kind, ticks: t.ticks.map(tickDto), rate: t.rate, trend: t.trend })),
    effort: i.effort.rows.map((e) => ({ subjectId: e.id, name: e.name, timeShare: e.timeShare, weightShare: e.weightShare, underInvested: e.underInvested })),
    focusByHour: i.hours,
    wellbeing: i.wellbeing,
    observations: i.observations.map((o) => ({ text: o.text, n: o.n, earlySignal: o.strength === "early" })),
  });
});
