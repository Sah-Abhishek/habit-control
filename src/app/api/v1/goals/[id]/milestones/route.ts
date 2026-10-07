import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { milestoneDto } from "@/server/api/dto/goals";
import { id } from "@/server/schemas/common";
import { milestoneSchema } from "@/server/schemas/goals";
import { createMilestone } from "@/server/services/goals";

export const POST = apiRoute<{ id: string }>(async ({ req, userId }, params) => {
  const goalId = readParam(params.id, id);
  const m = await createMilestone(userId, goalId, await readJson(req, milestoneSchema));
  return ok(milestoneDto(m), 201);
});
