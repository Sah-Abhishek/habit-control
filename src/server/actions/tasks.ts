"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { runAction } from "@/server/result";
import { taskSchema } from "@/server/schemas/tasks";
import { createTask, deleteTask, setTaskDone, updateTask } from "@/server/services/tasks";

const id = z.string().uuid("Invalid id");
function revalidate(goalId?: string | null) {
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/goals");
  if (goalId) revalidatePath(`/goals/${goalId}`);
}

export async function createTaskAction(input: unknown) {
  const user = await requireUser();
  return runAction("createTask", taskSchema, input, async (data) => {
    const task = await createTask(user.id, data);
    revalidate(task.goalId);
    return { id: task.id };
  });
}

export async function updateTaskAction(input: unknown) {
  const user = await requireUser();
  return runAction("updateTask", z.object({ id, data: taskSchema }), input, async ({ id, data }) => {
    const task = await updateTask(user.id, id, data);
    revalidate(task.goalId);
  });
}

export async function toggleTaskAction(input: { id: string; done: boolean }) {
  const user = await requireUser();
  return runAction("toggleTask", z.object({ id, done: z.boolean() }), input, async ({ id, done }) => {
    await setTaskDone(user.id, id, done);
    revalidate();
  });
}

export async function deleteTaskAction(input: unknown) {
  const user = await requireUser();
  return runAction("deleteTask", z.object({ id }), input, async ({ id }) => {
    const t = await deleteTask(user.id, id);
    revalidate(t.goalId);
    // Returned so the UI can offer Undo by re-creating it.
    return {
      title: t.title,
      notes: t.notes,
      dueDate: t.dueDate,
      priority: t.priority,
      goalId: t.goalId,
      subjectId: t.subjectId,
      topicId: t.topicId,
      estimateMinutes: t.estimateMinutes,
    };
  });
}
