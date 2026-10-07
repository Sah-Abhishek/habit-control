import { apiRoute, ok, readJson } from "@/server/api/handler";
import { getSubjectSummary } from "@/server/api/dto/subject-lookup";
import { subjectSummaryDto } from "@/server/api/dto/study";
import { subjectSchema } from "@/server/schemas/study";
import { createSubject } from "@/server/services/study";

export const POST = apiRoute(async ({ req, userId }) => {
  const s = await createSubject(userId, await readJson(req, subjectSchema));
  return ok(subjectSummaryDto(await getSubjectSummary(userId, s.id)), 201);
});
