import { apiRoute, ok, readJson } from "@/server/api/handler";
import { habitDto, habitSummaryDto } from "@/server/api/dto/habits";
import { habitSchema } from "@/server/schemas/habits";
import { createHabit, habitSummaries, listHabits } from "@/server/services/habits";

export const GET = apiRoute(async ({ userId, today }) => {
  const [summaries, all] = await Promise.all([habitSummaries(userId, today), listHabits(userId, { includeArchived: true })]);
  return ok({
    today,
    habits: summaries.map(habitSummaryDto),
    archived: all.filter((h) => h.archivedAt).map((h) => ({ id: h.id, name: h.name, kind: h.kind })),
  });
});

export const POST = apiRoute(async ({ req, userId, today }) => {
  const input = await readJson(req, habitSchema);
  return ok(habitDto(await createHabit(userId, input, today)), 201);
});
