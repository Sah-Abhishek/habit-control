import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { dayEntryDto } from "@/server/api/dto/days";
import { localDate } from "@/server/schemas/common";
import { sleepSchema } from "@/server/schemas/days";
import { clearSleep, saveSleep } from "@/server/services/days";

type Params = { date: string };

/** Sleep logged on day D is the night ending the morning of D. Idempotent. */
export const PUT = apiRoute<Params>(async ({ req, userId, today, settings }, params) => {
  const date = readParam(params.date, localDate);
  const day = await saveSleep(userId, date, await readJson(req, sleepSchema), settings.timezone, today);
  return ok(await dayEntryDto(userId, date, day, settings.timezone));
});

export const DELETE = apiRoute<Params>(async ({ userId, today }, params) => {
  await clearSleep(userId, readParam(params.date, localDate), today);
  return new Response(null, { status: 204 });
});
