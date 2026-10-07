import { apiRoute, ok, readParam } from "@/server/api/handler";
import { id } from "@/server/schemas/common";
import { completeRevision } from "@/server/services/study";

export const POST = apiRoute<{ id: string }>(async ({ userId }, params) => ok(await completeRevision(userId, readParam(params.id, id))));
