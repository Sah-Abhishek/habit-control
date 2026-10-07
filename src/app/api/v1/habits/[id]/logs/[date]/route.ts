import { z } from "zod";
import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { id, localDate } from "@/server/schemas/common";
import { logHabit } from "@/server/services/habits";

/** Idempotent: sets the day's value. Safe for offline retries. 0 clears the day. */
export const PUT = apiRoute<{ id: string; date: string }>(async ({ req, userId, today }, params) => {
  const { value } = await readJson(req, z.object({ value: z.number().min(0).max(100_000) }));
  return ok(await logHabit(userId, readParam(params.id, id), readParam(params.date, localDate), "set", value, today));
});
