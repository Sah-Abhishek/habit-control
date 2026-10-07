import { apiRoute, ok } from "@/server/api/handler";
import { listTopicOptions } from "@/server/services/study";

export const GET = apiRoute(async ({ userId }) => ok({ topics: await listTopicOptions(userId) }));
