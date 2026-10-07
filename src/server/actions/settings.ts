"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { runAction } from "@/server/result";
import { settingsSchema, timezoneSchema as timezone } from "@/server/schemas/settings";
import { getSettings, updateSettings } from "@/server/services/settings";

/** Called right after sign-up with the browser's timezone. Only sets it if still the default. */
export async function initializeSettingsAction(input: unknown) {
  const user = await requireUser();
  return runAction("initializeSettings", z.object({ timezone }), input, async ({ timezone }) => {
    const settings = await getSettings(user.id);
    if (settings.timezone === "UTC" && timezone !== "UTC") await updateSettings(user.id, { timezone });
  });
}

export async function updateSettingsAction(input: unknown) {
  const user = await requireUser();
  return runAction("updateSettings", settingsSchema, input, async (patch) => {
    await updateSettings(user.id, patch);
    revalidatePath("/", "layout");
  });
}
