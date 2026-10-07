import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { dayEntryDto } from "@/server/api/dto/days";
import { localDate } from "@/server/schemas/common";
import { checkInPatchSchema } from "@/server/schemas/days";
import { saveCheckIn } from "@/server/services/days";

/** Idempotent partial update: only fields present in the body change; null clears a value. */
export const PATCH = apiRoute<{ date: string }>(async ({ req, userId, today, settings }, params) => {
  const date = readParam(params.date, localDate);
  const day = await saveCheckIn(userId, date, await readJson(req, checkInPatchSchema), today);
  return ok(await dayEntryDto(userId, date, day, settings.timezone));
});
