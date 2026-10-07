import { apiRoute, ok, readJson } from "@/server/api/handler";
import { sessionDto } from "@/server/api/dto/study";
import { detailsSchema, timesSchema } from "@/server/schemas/study";
import { getSession, logPastSession } from "@/server/services/study";

export const POST = apiRoute(async ({ req, userId }) => {
  const input = await readJson(req, timesSchema.and(detailsSchema));
  const { id } = await logPastSession(userId, input);
  return ok(sessionDto(await getSession(userId, id)), 201);
});
