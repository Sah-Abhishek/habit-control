"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { runAction } from "@/server/result";
import { goalSchema, goalStatusSchema, milestoneSchema } from "@/server/schemas/goals";
import {
  createGoal,
  createMilestone,
  deleteGoal,
  deleteMilestone,
  moveMilestone,
  setGoalStatus,
  setMilestoneComplete,
  setPrimaryGoal,
  updateGoal,
  updateMilestone,
} from "@/server/services/goals";

const id = z.string().uuid("Invalid id");
function revalidate(goalId?: string) {
  revalidatePath("/");
  revalidatePath("/goals");
  if (goalId) revalidatePath(`/goals/${goalId}`);
}

export async function createGoalAction(input: unknown) {
  const user = await requireUser();
  return runAction("createGoal", goalSchema, input, async (data) => {
    const g = await createGoal(user.id, data);
    revalidate();
    return { id: g.id };
  });
}

export async function updateGoalAction(input: unknown) {
  const user = await requireUser();
  return runAction("updateGoal", z.object({ id, data: goalSchema }), input, async ({ id, data }) => {
    await updateGoal(user.id, id, data);
    revalidate(id);
  });
}

export async function setPrimaryGoalAction(input: unknown) {
  const user = await requireUser();
  return runAction("setPrimaryGoal", z.object({ id }), input, async ({ id }) => {
    await setPrimaryGoal(user.id, id);
    revalidate(id);
  });
}

export async function setGoalStatusAction(input: unknown) {
  const user = await requireUser();
  return runAction("setGoalStatus", z.object({ id, status: goalStatusSchema }), input, async ({ id, status }) => {
    const previous = await setGoalStatus(user.id, id, status);
    revalidate(id);
    return { previous };
  });
}

export async function deleteGoalAction(input: unknown) {
  const user = await requireUser();
  return runAction("deleteGoal", z.object({ id }), input, async ({ id }) => {
    await deleteGoal(user.id, id);
    revalidate();
  });
}

export async function createMilestoneAction(input: unknown) {
  const user = await requireUser();
  return runAction("createMilestone", z.object({ goalId: id, data: milestoneSchema }), input, async ({ goalId, data }) => {
    await createMilestone(user.id, goalId, data);
    revalidate(goalId);
  });
}

export async function updateMilestoneAction(input: unknown) {
  const user = await requireUser();
  return runAction("updateMilestone", z.object({ id, data: milestoneSchema }), input, async ({ id, data }) => {
    const m = await updateMilestone(user.id, id, data);
    revalidate(m.goalId);
  });
}

export async function setMilestoneCompleteAction(input: unknown) {
  const user = await requireUser();
  return runAction("setMilestoneComplete", z.object({ id, complete: z.boolean(), goalId: id }), input, async ({ id, complete, goalId }) => {
    const r = await setMilestoneComplete(user.id, id, complete);
    revalidate(goalId);
    return r;
  });
}

export async function moveMilestoneAction(input: unknown) {
  const user = await requireUser();
  return runAction("moveMilestone", z.object({ id, direction: z.enum(["up", "down"]) }), input, async ({ id, direction }) => {
    const { goalId } = await moveMilestone(user.id, id, direction);
    revalidate(goalId);
  });
}

export async function deleteMilestoneAction(input: unknown) {
  const user = await requireUser();
  return runAction("deleteMilestone", z.object({ id }), input, async ({ id }) => {
    const { goalId } = await deleteMilestone(user.id, id);
    revalidate(goalId);
  });
}
