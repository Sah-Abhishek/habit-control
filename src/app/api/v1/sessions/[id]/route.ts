import { z } from "zod";
import { apiRoute, ok, readJson, readParam, validate } from "@/server/api/handler";
import { runningSessionDto, sessionDto } from "@/server/api/dto/study";
import { id } from "@/server/schemas/common";
import { detailsSchema, topicProgress } from "@/server/schemas/study";
import { deleteSession, getSession, setTopicProgress, updateSessionDetails } from "@/server/services/study";

type Params = { id: string };

/** One session; a running one includes the server-computed elapsed time. */
export const GET = apiRoute<Params>(async ({ userId }, params) => {
  const session = await getSession(userId, readParam(params.id, id));
  return ok(session.endedAt ? sessionDto(session) : runningSessionDto(session));
});

/** Partial update: omitted fields keep their current values. `topicProgress` updates the linked topic. */
export const PATCH = apiRoute<Params>(async ({ req, userId }, params) => {
  const sessionId = readParam(params.id, id);
  const body = await readJson(req, z.record(z.string(), z.unknown()));
  const current = await getSession(userId, sessionId);
  const merged = {
    subjectId: current.subjectId,
    topicId: current.topicId,
    method: current.method,
    focus: current.focus,
    questionsAttempted: current.questionsAttempted,
    questionsCorrect: current.questionsCorrect,
    notes: current.notes,
    ...Object.fromEntries(Object.entries(body).filter(([k]) => k !== "topicProgress")),
  };
  const details = validate(detailsSchema, merged);
  const progress = validate(topicProgress.nullish(), body.topicProgress ?? null);
  await updateSessionDetails(userId, sessionId, details);
  if (details.topicId && progress != null) await setTopicProgress(userId, details.topicId, progress);
  return ok(sessionDto(await getSession(userId, sessionId)));
});

export const DELETE = apiRoute<Params>(async ({ userId }, params) => {
  await deleteSession(userId, readParam(params.id, id));
  return new Response(null, { status: 204 });
});
