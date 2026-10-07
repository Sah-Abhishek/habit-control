import { addLocalDays, diffLocalDays, hourOfDayIn } from "@/domain/dates";
import { apiRoute, ok } from "@/server/api/handler";
import { checkInDto } from "@/server/api/dto/days";
import { habitSummaryDto } from "@/server/api/dto/habits";
import { dueRevisionDto, runningSessionDto } from "@/server/api/dto/study";
import { taskRowDto } from "@/server/api/dto/tasks";
import { getPrimaryGoalSummary } from "@/server/services/goals";
import { habitSummaries } from "@/server/services/habits";
import { revisionsDue } from "@/server/services/study";
import { listTasksForDay } from "@/server/services/tasks";
import { focusLabelFor, getTodayExtras, goalDayCount } from "@/server/services/today";

function greeting(hour: number): "morning" | "afternoon" | "evening" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

export const GET = apiRoute(async ({ userId, today, settings }) => {
  const tz = settings.timezone;
  const [habits, tasks, goal, revisions, extras] = await Promise.all([
    habitSummaries(userId, today),
    listTasksForDay(userId, today),
    getPrimaryGoalSummary(userId, today),
    revisionsDue(userId, today),
    getTodayExtras(userId, today, tz, settings.weekStartsOn),
  ]);
  const [goalDay, focusLabel] = await Promise.all([goal ? goalDayCount(userId, goal.id, today) : null, focusLabelFor(userId, extras.day)]);
  const nextMilestone = goal?.milestones.find((m) => !m.completed);
  const feeds = goal ? `${goal.title}${nextMilestone ? ` · ${nextMilestone.title} (${Math.round(nextMilestone.progress)}%)` : ""}` : null;
  const day = extras.day;

  return ok({
    today,
    greeting: greeting(hourOfDayIn(tz, new Date())),
    goalDay,
    focus: { topicId: day?.focusTopicId ?? null, text: day?.focusText ?? null, label: focusLabel, feeds: focusLabel ? feeds : null },
    study: { todaySeconds: extras.studySecondsToday, targetSeconds: settings.dailyStudyTargetMin * 60 },
    timeline: extras.blocks,
    nowHour: extras.nowHour,
    habits: habits.filter((h) => h.scheduledToday).map(habitSummaryDto),
    tasks: tasks.map((t) => taskRowDto(t, today)),
    revisionsDue: revisions.map(dueRevisionDto),
    goal,
    week: Array.from({ length: 7 }, (_, i) => {
      const date = addLocalDays(extras.weekStart, i);
      return { date, seconds: extras.weekSeconds.get(date) ?? 0, future: diffLocalDays(date, today) > 0 };
    }),
    checkIn: checkInDto(day, tz),
    runningSession: extras.running ? runningSessionDto(extras.running) : null,
    observation: extras.observation ? { text: extras.observation.text, n: extras.observation.days, earlySignal: extras.observation.days < 30 } : null,
  });
});
