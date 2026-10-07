import { z } from "zod";
import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { milestoneDto } from "@/server/api/dto/goals";
import { id } from "@/server/schemas/common";
import { getMilestone, setMilestoneComplete } from "@/server/services/goals";

export const PUT = apiRoute<{ id: string }>(async ({ req, userId }, params) => {
  const milestoneId = readParam(params.id, id);
  const { complete } = await readJson(req, z.object({ complete: z.boolean() }));
  await setMilestoneComplete(userId, milestoneId, complete);
  return ok(milestoneDto(await getMilestone(userId, milestoneId)));
});
