import { apiRoute, ok, readParam } from "@/server/api/handler";
import { id } from "@/server/schemas/common";
import { reopenRevision } from "@/server/services/study";

/** Undo for "complete": marks the revision as not done again. Idempotent. */
export const POST = apiRoute<{ id: string }>(async ({ userId }, params) => {
  await reopenRevision(userId, readParam(params.id, id));
  return ok({ reopened: true });
});
