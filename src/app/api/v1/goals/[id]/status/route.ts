import { z } from "zod";
import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { id } from "@/server/schemas/common";
import { goalStatusSchema } from "@/server/schemas/goals";
import { setGoalStatus } from "@/server/services/goals";

export const PUT = apiRoute<{ id: string }>(async ({ req, userId }, params) => {
  const { status } = await readJson(req, z.object({ status: goalStatusSchema }));
  await setGoalStatus(userId, readParam(params.id, id), status);
  return ok({ status });
});
