"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLocalDate } from "@/domain/dates";
import { requireUser } from "@/server/auth/session";
import { runAction } from "@/server/result";
import { detailsSchema, startSessionSchema, subjectSchema, tallySchema, timesSchema, topicName, topicProgress } from "@/server/schemas/study";
import { getToday } from "@/server/services/settings";
import {
  completeRevision,
  createSubject,
  createTopic,
  deleteSession,
  deleteSubject,
  deleteTopic,
  editSessionTimes,
  finishSession,
  logPastSession,
  moveTopic,
  pauseSession,
  renameTopic,
  reopenRevision,
  resumeSession,
  setRevisionDueDate,
  setSubjectArchived,
  setTopicCompleted,
  setTopicProgress,
  snoozeRevision,
  startSession,
  tallySession,
  trimSession,
  updateSessionDetails,
  updateSubject,
} from "@/server/services/study";

const id = z.string().uuid("Invalid id");
const localDate = z.string().refine(isLocalDate, "Invalid date");

// Study data feeds Today, Calendar and Insights, so refresh the whole app tree.
function revalidate() {
  revalidatePath("/", "layout");
}

/* Subjects */

export async function createSubjectAction(input: unknown) {
  const user = await requireUser();
  return runAction("createSubject", subjectSchema, input, async (data) => {
    const s = await createSubject(user.id, data);
    revalidate();
    return { id: s.id };
  });
}

export async function updateSubjectAction(input: unknown) {
  const user = await requireUser();
  return runAction("updateSubject", z.object({ id, data: subjectSchema }), input, async ({ id, data }) => {
    await updateSubject(user.id, id, data);
    revalidate();
  });
}

export async function archiveSubjectAction(input: unknown) {
  const user = await requireUser();
  return runAction("archiveSubject", z.object({ id, archived: z.boolean() }), input, async ({ id, archived }) => {
    await setSubjectArchived(user.id, id, archived);
    revalidate();
  });
}

export async function deleteSubjectAction(input: unknown) {
  const user = await requireUser();
  return runAction("deleteSubject", z.object({ id }), input, async ({ id }) => {
    await deleteSubject(user.id, id);
    revalidate();
  });
}

/* Topics */

export async function createTopicAction(input: unknown) {
  const user = await requireUser();
  return runAction("createTopic", z.object({ subjectId: id, name: topicName }), input, async ({ subjectId, name }) => {
    const t = await createTopic(user.id, subjectId, name);
    revalidate();
    return { id: t.id };
  });
}

export async function renameTopicAction(input: unknown) {
  const user = await requireUser();
  return runAction("renameTopic", z.object({ id, name: topicName }), input, async ({ id, name }) => {
    await renameTopic(user.id, id, name);
    revalidate();
  });
}

export async function moveTopicAction(input: unknown) {
  const user = await requireUser();
  return runAction("moveTopic", z.object({ id, direction: z.enum(["up", "down"]) }), input, async ({ id, direction }) => {
    await moveTopic(user.id, id, direction);
    revalidate();
  });
}

export async function deleteTopicAction(input: unknown) {
  const user = await requireUser();
  return runAction("deleteTopic", z.object({ id }), input, async ({ id }) => {
    await deleteTopic(user.id, id);
    revalidate();
  });
}

export async function setTopicProgressAction(input: unknown) {
  const user = await requireUser();
  return runAction("setTopicProgress", z.object({ id, progress: topicProgress }), input, async ({ id, progress }) => {
    const t = await setTopicProgress(user.id, id, progress);
    revalidate();
    return { progress: t.progress };
  });
}

export async function setTopicCompletedAction(input: unknown) {
  const user = await requireUser();
  return runAction("setTopicCompleted", z.object({ id, completed: z.boolean() }), input, async ({ id, completed }) => {
    const { today } = await getToday(user.id);
    await setTopicCompleted(user.id, id, completed, today);
    revalidate();
  });
}

/* Revisions */

export async function completeRevisionAction(input: { id: string }) {
  const user = await requireUser();
  return runAction("completeRevision", z.object({ id }), input, async ({ id }) => {
    const res = await completeRevision(user.id, id);
    revalidate();
    return res;
  });
}

export async function reopenRevisionAction(input: { id: string }) {
  const user = await requireUser();
  return runAction("reopenRevision", z.object({ id }), input, async ({ id }) => {
    await reopenRevision(user.id, id);
    revalidate();
  });
}

export async function snoozeRevisionAction(input: { id: string }) {
  const user = await requireUser();
  return runAction("snoozeRevision", z.object({ id }), input, async ({ id }) => {
    const { today } = await getToday(user.id);
    const res = await snoozeRevision(user.id, id, today);
    revalidate();
    return res;
  });
}

export async function setRevisionDueDateAction(input: { id: string; dueDate: string }) {
  const user = await requireUser();
  return runAction("setRevisionDueDate", z.object({ id, dueDate: localDate }), input, async ({ id, dueDate }) => {
    await setRevisionDueDate(user.id, id, dueDate);
    revalidate();
  });
}

/* Sessions */

export async function startSessionAction(input: { subjectId?: string | null; topicId?: string | null; method?: string | null }) {
  const user = await requireUser();
  return runAction("startSession", startSessionSchema, input, async (data) => {
    const res = await startSession(user.id, data);
    revalidate();
    return res;
  });
}

export async function pauseSessionAction(input: { id: string }) {
  const user = await requireUser();
  return runAction("pauseSession", z.object({ id }), input, async ({ id }) => {
    await pauseSession(user.id, id);
    revalidate();
  });
}

export async function resumeSessionAction(input: { id: string }) {
  const user = await requireUser();
  return runAction("resumeSession", z.object({ id }), input, async ({ id }) => {
    await resumeSession(user.id, id);
    revalidate();
  });
}

export async function finishSessionAction(input: { id: string }) {
  const user = await requireUser();
  return runAction("finishSession", z.object({ id }), input, async ({ id }) => {
    const res = await finishSession(user.id, id);
    revalidate();
    return res;
  });
}

export async function tallySessionAction(input: { id: string; result: "correct" | "missed" | "undo-correct" | "undo-missed" }) {
  const user = await requireUser();
  return runAction("tallySession", z.object({ id }).and(tallySchema), input, async ({ id, result }) => tallySession(user.id, id, result));
}

export async function updateSessionDetailsAction(input: unknown) {
  const user = await requireUser();
  const schema = z.object({ id, details: detailsSchema, topicProgress: z.coerce.number().int().min(0).max(100).nullish() });
  return runAction("updateSessionDetails", schema, input, async ({ id, details, topicProgress }) => {
    await updateSessionDetails(user.id, id, details);
    if (details.topicId && topicProgress != null) await setTopicProgress(user.id, details.topicId, topicProgress);
    revalidate();
  });
}

export async function editSessionTimesAction(input: unknown) {
  const user = await requireUser();
  return runAction("editSessionTimes", z.object({ id }).and(timesSchema), input, async ({ id, ...times }) => {
    const res = await editSessionTimes(user.id, id, times);
    revalidate();
    return res;
  });
}

export async function trimSessionAction(input: { id: string; endedAt: string }) {
  const user = await requireUser();
  return runAction("trimSession", z.object({ id, endedAt: z.string().datetime() }), input, async ({ id, endedAt }) => {
    const res = await trimSession(user.id, id, new Date(endedAt));
    revalidate();
    return res;
  });
}

export async function logPastSessionAction(input: unknown) {
  const user = await requireUser();
  return runAction("logPastSession", timesSchema.and(detailsSchema), input, async (data) => {
    const res = await logPastSession(user.id, data);
    revalidate();
    return res;
  });
}

export async function deleteSessionAction(input: { id: string }) {
  const user = await requireUser();
  return runAction("deleteSession", z.object({ id }), input, async ({ id }) => {
    await deleteSession(user.id, id);
    revalidate();
  });
}
