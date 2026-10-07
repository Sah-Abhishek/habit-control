"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { runAction } from "@/server/result";
import { id } from "@/server/schemas/common";
import { habitSchema, logHabitSchema } from "@/server/schemas/habits";
import { createHabit, deleteHabit, logHabit, setHabitArchived, updateHabit } from "@/server/services/habits";
import { getToday } from "@/server/services/settings";

function revalidate(habitId?: string) {
  revalidatePath("/");
  revalidatePath("/habits");
  if (habitId) revalidatePath(`/habits/${habitId}`);
  revalidatePath("/insights");
  revalidatePath("/calendar");
}

export async function createHabitAction(input: unknown) {
  const user = await requireUser();
  return runAction("createHabit", habitSchema, input, async (data) => {
    const { today } = await getToday(user.id);
    const habit = await createHabit(user.id, data, today);
    revalidate();
    return { id: habit.id };
  });
}

export async function updateHabitAction(input: unknown) {
  const user = await requireUser();
  return runAction("updateHabit", z.object({ id, data: habitSchema }), input, async ({ id, data }) => {
    await updateHabit(user.id, id, data);
    revalidate(id);
  });
}

export async function archiveHabitAction(input: unknown) {
  const user = await requireUser();
  return runAction("archiveHabit", z.object({ id, archived: z.boolean() }), input, async ({ id, archived }) => {
    await setHabitArchived(user.id, id, archived);
    revalidate(id);
  });
}

export async function deleteHabitAction(input: unknown) {
  const user = await requireUser();
  return runAction("deleteHabit", z.object({ id }), input, async ({ id }) => {
    await deleteHabit(user.id, id);
    revalidate();
  });
}

export async function logHabitAction(input: unknown) {
  const user = await requireUser();
  return runAction("logHabit", logHabitSchema, input, async ({ habitId, date, mode, value }) => {
    const { today } = await getToday(user.id);
    const result = await logHabit(user.id, habitId, date ?? today, mode, value, today);
    revalidate(habitId);
    return result;
  });
}
