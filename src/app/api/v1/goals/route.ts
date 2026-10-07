import { apiRoute, ok, readJson } from "@/server/api/handler";
import { goalCardDto } from "@/server/api/dto/goals";
import { goalSchema } from "@/server/schemas/goals";
import { createGoal, getGoalCard, listGoalCards } from "@/server/services/goals";

export const GET = apiRoute(async ({ userId, today }) => ok({ goals: (await listGoalCards(userId, today)).map(goalCardDto) }));

export const POST = apiRoute(async ({ req, userId, today }) => {
  const input = await readJson(req, goalSchema);
  const goal = await createGoal(userId, input);
  return ok(goalCardDto(await getGoalCard(userId, goal.id, today)), 201);
});
