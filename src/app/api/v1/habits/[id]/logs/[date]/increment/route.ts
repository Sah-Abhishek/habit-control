import { z } from "zod";
import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { id, localDate } from "@/server/schemas/common";
import { logHabit } from "@/server/services/habits";

/** Atomic +/- delta. NOT idempotent — clients replaying offline should use PUT instead. */
export const POST = apiRoute<{ id: string; date: string }>(async ({ req, userId, today }, params) => {
  const { delta } = await readJson(req, z.object({ delta: z.number().int().min(-1000).max(1000) }));
  return ok(await logHabit(userId, readParam(params.id, id), readParam(params.date, localDate), "increment", delta, today));
});
