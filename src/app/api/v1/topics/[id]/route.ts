import { z } from "zod";
import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { topicDto } from "@/server/api/dto/study";
import { id } from "@/server/schemas/common";
import { topicName, topicProgress } from "@/server/schemas/study";
import { deleteTopic, getTopic, renameTopic, setTopicProgress, topicRevisions } from "@/server/services/study";

type Params = { id: string };

export const PATCH = apiRoute<Params>(async ({ req, userId }, params) => {
  const topicId = readParam(params.id, id);
  const { name, progress } = await readJson(req, z.object({ name: topicName.optional(), progress: topicProgress.optional() }));
  await getTopic(userId, topicId);
  if (name !== undefined) await renameTopic(userId, topicId, name);
  if (progress !== undefined) await setTopicProgress(userId, topicId, progress);
  const topic = await getTopic(userId, topicId);
  return ok(topicDto(topic, (await topicRevisions(userId, [topicId])).get(topicId) ?? []));
});

export const DELETE = apiRoute<Params>(async ({ userId }, params) => {
  await deleteTopic(userId, readParam(params.id, id));
  return new Response(null, { status: 204 });
});
