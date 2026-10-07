import { z } from "zod";
import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { topicDto } from "@/server/api/dto/study";
import { id } from "@/server/schemas/common";
import { setTopicCompleted, topicRevisions } from "@/server/services/study";

/** Completing schedules revisions (idempotent); reopening removes pending ones. */
export const PUT = apiRoute<{ id: string }>(async ({ req, userId, today }, params) => {
  const topicId = readParam(params.id, id);
  const { completed } = await readJson(req, z.object({ completed: z.boolean() }));
  const topic = await setTopicCompleted(userId, topicId, completed, today);
  return ok(topicDto(topic, (await topicRevisions(userId, [topicId])).get(topicId) ?? []));
});
