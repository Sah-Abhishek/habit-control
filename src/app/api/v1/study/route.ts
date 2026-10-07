import { apiRoute, ok } from "@/server/api/handler";
import { dueRevisionDto, runningSessionDto, sessionDto, subjectSummaryDto } from "@/server/api/dto/study";
import { getRunningSession, listSubjectSummaries, recentSessions, revisionsDue, studySecondsByDay } from "@/server/services/study";

export const GET = apiRoute(async ({ userId, today, settings }) => {
  const [subjects, due, recent, running, todaySeconds] = await Promise.all([
    listSubjectSummaries(userId),
    revisionsDue(userId, today),
    recentSessions(userId, { limit: 10 }),
    getRunningSession(userId),
    studySecondsByDay(userId, today, today),
  ]);
  return ok({
    subjects: subjects.map(subjectSummaryDto),
    revisionsDue: due.map(dueRevisionDto),
    recentSessions: recent.map(sessionDto),
    running: running ? runningSessionDto(running) : null,
    todaySeconds: todaySeconds.get(today) ?? 0,
    targetSeconds: settings.dailyStudyTargetMin * 60,
  });
});
