import { apiRoute, ok, readParam } from "@/server/api/handler";
import { id } from "@/server/schemas/common";
import { setPrimaryGoal } from "@/server/services/goals";

export const PUT = apiRoute<{ id: string }>(async ({ userId }, params) => {
  await setPrimaryGoal(userId, readParam(params.id, id));
  return ok({ isPrimary: true });
});
