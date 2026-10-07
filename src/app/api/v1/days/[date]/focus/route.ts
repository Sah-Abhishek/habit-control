import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { dayEntryDto } from "@/server/api/dto/days";
import { localDate } from "@/server/schemas/common";
import { focusSchema } from "@/server/schemas/days";
import { saveFocus } from "@/server/services/days";

/** Idempotent. Omitted fields are treated as null; both null clears the day's focus. */
export const PUT = apiRoute<{ date: string }>(async ({ req, userId, today, settings }, params) => {
  const date = readParam(params.date, localDate);
  const input = await readJson(req, focusSchema.partial());
  const day = await saveFocus(userId, date, { topicId: input.topicId ?? null, text: input.text ?? null }, today);
  return ok(await dayEntryDto(userId, date, day, settings.timezone));
});
