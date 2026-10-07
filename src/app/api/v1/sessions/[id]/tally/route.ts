import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { id } from "@/server/schemas/common";
import { tallySchema } from "@/server/schemas/study";
import { tallySession } from "@/server/services/study";

export const POST = apiRoute<{ id: string }>(async ({ req, userId }, params) => {
  const { result } = await readJson(req, tallySchema);
  return ok(await tallySession(userId, readParam(params.id, id), result));
});
