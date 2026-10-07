import { z } from "zod";
import { apiRoute, ok, readJson, readQuery } from "@/server/api/handler";
import { taskRowDto } from "@/server/api/dto/tasks";
import { taskFilterSchema, taskSchema } from "@/server/schemas/tasks";
import { createTask, getTaskRow, listTasks } from "@/server/services/tasks";

export const GET = apiRoute(async ({ req, userId, today }) => {
  const { filter } = readQuery(req, z.object({ filter: taskFilterSchema.default("today") }));
  const rows = await listTasks(userId, filter, today);
  return ok({ tasks: rows.map((t) => taskRowDto(t, today)) });
});

export const POST = apiRoute(async ({ req, userId, today }) => {
  const input = await readJson(req, taskSchema);
  const task = await createTask(userId, input);
  return ok(taskRowDto(await getTaskRow(userId, task.id), today), 201);
});
