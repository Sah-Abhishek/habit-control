import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { id } from "@/server/schemas/common";
import { taskDoneSchema } from "@/server/schemas/tasks";
import { setTaskDone } from "@/server/services/tasks";

/** Idempotent (safe for offline replay): completing twice keeps the first completion time. */
export const PUT = apiRoute<{ id: string }>(async ({ req, userId }, params) => {
  const { done } = await readJson(req, taskDoneSchema);
  await setTaskDone(userId, readParam(params.id, id), done);
  return ok({ done });
});
