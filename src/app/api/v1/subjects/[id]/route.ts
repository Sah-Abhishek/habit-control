import { combinedAccuracy } from "@/domain/study";
import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { getSubjectSummary } from "@/server/api/dto/subject-lookup";
import { sessionDto, subjectSummaryDto, topicDto } from "@/server/api/dto/study";
import { id } from "@/server/schemas/common";
import { subjectSchema } from "@/server/schemas/study";
import { deleteSubject, listTopics, recentSessions, subjectQuestionTotals, topicRevisions, updateSubject } from "@/server/services/study";

type Params = { id: string };

export const GET = apiRoute<Params>(async ({ userId }, params) => {
  const subjectId = readParam(params.id, id);
  const subject = await getSubjectSummary(userId, subjectId);
  const [topics, recent, totals] = await Promise.all([listTopics(userId, subjectId), recentSessions(userId, { subjectId, limit: 10 }), subjectQuestionTotals(userId, subjectId)]);
  const revs = await topicRevisions(userId, topics.map((t) => t.id));
  return ok({
    subject: subjectSummaryDto(subject),
    topics: topics.map((t) => topicDto(t, revs.get(t.id) ?? [])),
    recentSessions: recent.map(sessionDto),
    accuracy: combinedAccuracy(totals).rate,
  });
});

export const PATCH = apiRoute<Params>(async ({ req, userId }, params) => {
  const subjectId = readParam(params.id, id);
  await updateSubject(userId, subjectId, await readJson(req, subjectSchema));
  return ok(subjectSummaryDto(await getSubjectSummary(userId, subjectId)));
});

export const DELETE = apiRoute<Params>(async ({ userId }, params) => {
  await deleteSubject(userId, readParam(params.id, id));
  return new Response(null, { status: 204 });
});
