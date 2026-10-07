import { z } from "zod";
import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { id } from "@/server/schemas/common";
import { setHabitArchived } from "@/server/services/habits";

export const PUT = apiRoute<{ id: string }>(async ({ req, userId }, params) => {
  const { archived } = await readJson(req, z.object({ archived: z.boolean() }));
  await setHabitArchived(userId, readParam(params.id, id), archived);
  return ok({ archived });
});
