import { z } from "zod";
import { apiRoute, ok, readJson } from "@/server/api/handler";
import { settingsDto } from "@/server/api/dto/me";
import { settingsSchema } from "@/server/schemas/settings";
import { updateSettings } from "@/server/services/settings";

/** Partial update. `onboarded: true` marks onboarding finished (idempotent; never un-set). */
export const PATCH = apiRoute(async ({ req, userId, settings }) => {
  const { onboarded, ...patch } = await readJson(req, settingsSchema.extend({ onboarded: z.literal(true).optional() }));
  const next = await updateSettings(userId, { ...patch, ...(onboarded && !settings.onboardedAt ? { onboardedAt: new Date() } : {}) });
  return ok(settingsDto(next));
});
