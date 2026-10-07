import { apiRoute, ok } from "@/server/api/handler";
import { taskOptionsDto } from "@/server/api/dto/tasks";
import { getTaskPickerOptions } from "@/server/services/tasks";

export const GET = apiRoute(async ({ userId }) => ok(taskOptionsDto(await getTaskPickerOptions(userId))));
