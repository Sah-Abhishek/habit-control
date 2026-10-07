import { z } from "zod";
import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { topicDto } from "@/server/api/dto/study";
import { id } from "@/server/schemas/common";
import { topicName } from "@/server/schemas/study";
import { createTopic } from "@/server/services/study";

export const POST = apiRoute<{ id: string }>(async ({ req, userId }, params) => {
  const { name } = await readJson(req, z.object({ name: topicName }));
  return ok(topicDto(await createTopic(userId, readParam(params.id, id), name)), 201);
});
