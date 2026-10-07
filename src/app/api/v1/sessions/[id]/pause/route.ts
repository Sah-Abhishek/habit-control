import { apiRoute, ok, readParam } from "@/server/api/handler";
import { runningSessionDto } from "@/server/api/dto/study";
import { id } from "@/server/schemas/common";
import { getSession, pauseSession } from "@/server/services/study";

export const POST = apiRoute<{ id: string }>(async ({ userId }, params) => {
  const sessionId = readParam(params.id, id);
  await pauseSession(userId, sessionId);
  return ok(runningSessionDto(await getSession(userId, sessionId)));
});
