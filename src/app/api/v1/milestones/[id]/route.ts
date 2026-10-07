import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { milestoneDto } from "@/server/api/dto/goals";
import { id } from "@/server/schemas/common";
import { milestoneSchema } from "@/server/schemas/goals";
import { deleteMilestone, updateMilestone } from "@/server/services/goals";

type Params = { id: string };

export const PATCH = apiRoute<Params>(async ({ req, userId }, params) => {
  const m = await updateMilestone(userId, readParam(params.id, id), await readJson(req, milestoneSchema));
  return ok(milestoneDto(m));
});

export const DELETE = apiRoute<Params>(async ({ userId }, params) => {
  await deleteMilestone(userId, readParam(params.id, id));
  return new Response(null, { status: 204 });
});
