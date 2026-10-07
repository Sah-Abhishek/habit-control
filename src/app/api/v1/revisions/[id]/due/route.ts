import { z } from "zod";
import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { id, localDate } from "@/server/schemas/common";
import { setRevisionDueDate } from "@/server/services/study";

/** Sets the due date (used to undo a snooze). Idempotent. */
export const PUT = apiRoute<{ id: string }>(async ({ req, userId }, params) => {
  const { dueDate } = await readJson(req, z.object({ dueDate: localDate }));
  await setRevisionDueDate(userId, readParam(params.id, id), dueDate);
  return ok({ dueDate });
});
