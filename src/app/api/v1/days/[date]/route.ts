import { apiRoute, ok, readParam } from "@/server/api/handler";
import { dayEntryDto } from "@/server/api/dto/days";
import { localDate } from "@/server/schemas/common";
import { getDay } from "@/server/services/days";

export const GET = apiRoute<{ date: string }>(async ({ userId, settings }, params) => {
  const date = readParam(params.date, localDate);
  return ok(await dayEntryDto(userId, date, await getDay(userId, date), settings.timezone));
});
