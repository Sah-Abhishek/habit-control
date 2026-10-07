import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { sessionDto } from "@/server/api/dto/study";
import { id } from "@/server/schemas/common";
import { timesSchema } from "@/server/schemas/study";
import { editSessionTimes, getSession } from "@/server/services/study";

export const PUT = apiRoute<{ id: string }>(async ({ req, userId }, params) => {
  const sessionId = readParam(params.id, id);
  await editSessionTimes(userId, sessionId, await readJson(req, timesSchema));
  return ok(sessionDto(await getSession(userId, sessionId)));
});
