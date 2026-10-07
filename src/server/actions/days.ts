"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLocalDate } from "@/domain/dates";
import { requireUser } from "@/server/auth/session";
import { runAction } from "@/server/result";
import { checkInPatchSchema, focusSchema, sleepSchema } from "@/server/schemas/days";
import { clearSleep, saveCheckIn, saveFocus, saveSleep } from "@/server/services/days";
import { getToday } from "@/server/services/settings";

const localDate = z.string().refine(isLocalDate, "Invalid date");
function revalidate() {
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/insights");
}

export async function saveCheckInAction(input: unknown) {
  const user = await requireUser();
  const schema = z.object({ date: localDate.optional() }).and(checkInPatchSchema);
  return runAction("saveCheckIn", schema, input, async ({ date, ...patch }) => {
    const { today } = await getToday(user.id);
    await saveCheckIn(user.id, date ?? today, patch, today);
    revalidate();
  });
}

export async function saveSleepAction(input: unknown) {
  const user = await requireUser();
  const schema = z.object({ date: localDate.optional() }).and(sleepSchema);
  return runAction("saveSleep", schema, input, async ({ date, ...rest }) => {
    const { today, settings } = await getToday(user.id);
    await saveSleep(user.id, date ?? today, rest, settings.timezone, today);
    revalidate();
  });
}

export async function clearSleepAction(input: unknown) {
  const user = await requireUser();
  return runAction("clearSleep", z.object({ date: localDate.optional() }), input, async ({ date }) => {
    const { today } = await getToday(user.id);
    await clearSleep(user.id, date ?? today, today);
    revalidate();
  });
}

export async function saveFocusAction(input: unknown) {
  const user = await requireUser();
  // Both null clears today's focus.
  const schema = z.object({ date: localDate.optional() }).and(focusSchema);
  return runAction("saveFocus", schema, input, async ({ date, topicId, text }) => {
    const { today } = await getToday(user.id);
    await saveFocus(user.id, date ?? today, { topicId, text }, today);
    revalidate();
  });
}
