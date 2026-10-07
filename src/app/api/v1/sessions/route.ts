import { z } from "zod";
import { diffLocalDays } from "@/domain/dates";
import { apiRoute, ok, readJson, readQuery } from "@/server/api/handler";
import { runningSessionDto, sessionDto } from "@/server/api/dto/study";
import { localDate } from "@/server/schemas/common";
import { startSessionSchema } from "@/server/schemas/study";
import { UserFacingError } from "@/server/result";
import { getSession, listSessionsInRange, startSession } from "@/server/services/study";

/** Finished sessions in a date range (≤ 92 days), newest first. */
export const GET = apiRoute(async ({ req, userId, today }) => {
  const { from, to } = readQuery(req, z.object({ from: localDate.default(today), to: localDate.default(today) }));
  const span = diffLocalDays(to, from);
  if (span < 0) throw new UserFacingError("“from” must be on or before “to”.", { from: "Must be ≤ to" });
  if (span > 91) throw new UserFacingError("Ask for at most 92 days at a time.", { to: "Range too long" });
  return ok({ sessions: (await listSessionsInRange(userId, from, to)).map(sessionDto) });
});

/** Starts a session. If one is already running, returns it (200 + X-Already-Running: 1) instead of creating another. */
export const POST = apiRoute(async ({ req, userId }) => {
  const input = await readJson(req, startSessionSchema);
  const { id, alreadyRunning } = await startSession(userId, input);
  const res = ok(runningSessionDto(await getSession(userId, id)), alreadyRunning ? 200 : 201);
  if (alreadyRunning) res.headers.set("X-Already-Running", "1");
  return res;
});
