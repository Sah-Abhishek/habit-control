import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { taskRowDto } from "@/server/api/dto/tasks";
import { id } from "@/server/schemas/common";
import { taskSchema } from "@/server/schemas/tasks";
import { deleteTask, getTaskRow, updateTask } from "@/server/services/tasks";

type Params = { id: string };

export const PATCH = apiRoute<Params>(async ({ req, userId, today }, params) => {
  const taskId = readParam(params.id, id);
  const input = await readJson(req, taskSchema);
  await updateTask(userId, taskId, input);
  return ok(taskRowDto(await getTaskRow(userId, taskId), today));
});

export const DELETE = apiRoute<Params>(async ({ userId }, params) => {
  await deleteTask(userId, readParam(params.id, id));
  return new Response(null, { status: 204 });
});
