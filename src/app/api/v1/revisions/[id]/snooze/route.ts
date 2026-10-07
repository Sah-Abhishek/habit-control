import { apiRoute, ok, readParam } from "@/server/api/handler";
import { id } from "@/server/schemas/common";
import { snoozeRevision } from "@/server/services/study";

export const POST = apiRoute<{ id: string }>(async ({ userId, today }, params) => ok(await snoozeRevision(userId, readParam(params.id, id), today)));
