import "server-only";
import { NotFoundError } from "@/server/result";
import { listSubjectSummaries, type SubjectSummary } from "@/server/services/study";

export async function getSubjectSummary(userId: string, id: string): Promise<SubjectSummary> {
  const s = (await listSubjectSummaries(userId, { includeArchived: true })).find((x) => x.id === id);
  if (!s) throw new NotFoundError("That subject");
  return s;
}
