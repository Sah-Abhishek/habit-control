import "server-only";
import { elapsedSeconds } from "@/domain/study";
import type { DueRevision, Revision, SessionWithNames, SubjectSummary, Topic } from "@/server/services/study";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function sessionDto(s: SessionWithNames) {
  return {
    id: s.id,
    subjectId: s.subjectId,
    subjectName: s.subjectName,
    topicId: s.topicId,
    topicName: s.topicName,
    method: s.method,
    startedAt: s.startedAt.toISOString(),
    endedAt: iso(s.endedAt),
    pausedAt: iso(s.pausedAt),
    pausedSeconds: s.pausedSeconds,
    localDate: s.localDate,
    durationSeconds: s.durationSeconds,
    focus: s.focus,
    questionsAttempted: s.questionsAttempted,
    questionsCorrect: s.questionsCorrect,
    notes: s.notes,
  };
}

/** A running session plus server-computed elapsed time, so clients never trust their own clock for storage. */
export function runningSessionDto(s: SessionWithNames, now = new Date()) {
  return { ...sessionDto(s), elapsedSeconds: elapsedSeconds(s, now), serverNow: now.toISOString() };
}

export function subjectSummaryDto(s: SubjectSummary) {
  return {
    id: s.id,
    name: s.name,
    goalId: s.goalId,
    goalTitle: s.goalTitle,
    weight: s.weight,
    progress: s.progress,
    topicCount: s.topicCount,
    completedTopics: s.completedCount,
    studySeconds: s.studySeconds,
    archived: s.archivedAt != null,
  };
}

export function topicDto(t: Topic, revisions: Revision[] = []) {
  return {
    id: t.id,
    subjectId: t.subjectId,
    name: t.name,
    progress: t.progress,
    status: t.status,
    position: t.position,
    revisions: revisions.map((r) => ({ id: r.id, step: r.step, dueDate: r.dueDate, completedAt: iso(r.completedAt), skippedAt: iso(r.skippedAt) })),
  };
}

export function dueRevisionDto(r: DueRevision) {
  return { id: r.id, step: r.step, dueDate: r.dueDate, overdueDays: r.overdueDays, topicId: r.topicId, topicName: r.topicName, subjectId: r.subjectId, subjectName: r.subjectName };
}
