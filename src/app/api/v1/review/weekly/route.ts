import { z } from "zod";
import { apiRoute, ok, readQuery } from "@/server/api/handler";
import { localDate } from "@/server/schemas/common";
import { getWeeklyReview } from "@/server/services/review";

/** `week` = any date in the week; default is the last completed week. */
export const GET = apiRoute(async ({ req, userId, today, settings }) => {
  const { week } = readQuery(req, z.object({ week: localDate.optional() }));
  return ok(await getWeeklyReview(userId, week, today, settings));
});
