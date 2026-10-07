import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { goalCardDto, milestoneDto } from "@/server/api/dto/goals";
import { taskRowDto } from "@/server/api/dto/tasks";
import { id } from "@/server/schemas/common";
import { goalSchema } from "@/server/schemas/goals";
import { deleteGoal, getGoalCard, getGoalDetail, updateGoal } from "@/server/services/goals";
import { habitSummaries } from "@/server/services/habits";
import { listTasksForGoal } from "@/server/services/tasks";

type Params = { id: string };

export const GET = apiRoute<Params>(async ({ userId, today }, params) => {
  const goalId = readParam(params.id, id);
  const [detail, card] = await Promise.all([getGoalDetail(userId, goalId, today), getGoalCard(userId, goalId, today)]);
  const [tasks, habitList] = await Promise.all([listTasksForGoal(userId, goalId), detail.habits.length ? habitSummaries(userId, today) : Promise.resolve([])]);
  const rates = new Map(habitList.map((h) => [h.habit.id, h.c30.rate]));
  return ok({
    goal: goalCardDto(card),
    // Fractions of the whole goal (0..1) per week.
    velocityPerWeek: detail.metrics.velocity,
    neededPerWeek: detail.metrics.needed,
    milestones: detail.milestones.map(milestoneDto),
    subjects: detail.subjects.map((s) => ({ id: s.id, name: s.name, progress: s.progress == null ? 0 : s.progress / 100 })),
    habits: detail.habits.map((h) => ({ id: h.id, name: h.name, rate30: rates.get(h.id) ?? null })),
    tasks: tasks.map((t) => taskRowDto(t, today)),
  });
});

export const PATCH = apiRoute<Params>(async ({ req, userId, today }, params) => {
  const goalId = readParam(params.id, id);
  await updateGoal(userId, goalId, await readJson(req, goalSchema));
  return ok(goalCardDto(await getGoalCard(userId, goalId, today)));
});

export const DELETE = apiRoute<Params>(async ({ userId }, params) => {
  await deleteGoal(userId, readParam(params.id, id));
  return new Response(null, { status: 204 });
});
