import { isForgottenTimer } from "@/domain/study";
import { apiRoute, ok, readParam } from "@/server/api/handler";
import { sessionDto } from "@/server/api/dto/study";
import { id } from "@/server/schemas/common";
import { finishSession, getSession } from "@/server/services/study";

/** Idempotent: finishing an already finished session returns it unchanged. */
export const POST = apiRoute<{ id: string }>(async ({ userId }, params) => {
  const sessionId = readParam(params.id, id);
  const { durationSeconds } = await finishSession(userId, sessionId);
  return ok({ session: sessionDto(await getSession(userId, sessionId)), longSession: isForgottenTimer(durationSeconds) });
});
