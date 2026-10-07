import { apiRoute, ok } from "@/server/api/handler";
import { runningSessionDto } from "@/server/api/dto/study";
import { getRunningSession } from "@/server/services/study";

export const GET = apiRoute(async ({ userId }) => {
  const running = await getRunningSession(userId);
  return ok(running ? runningSessionDto(running) : null);
});
