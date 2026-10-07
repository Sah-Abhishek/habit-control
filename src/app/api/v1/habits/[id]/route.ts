import { addLocalDays } from "@/domain/dates";
import { dayState, thread, weeklyAverages } from "@/domain/habits";
import { apiRoute, ok, readJson, readParam } from "@/server/api/handler";
import { habitDto, habitSummaryDto, tickDto } from "@/server/api/dto/habits";
import { id } from "@/server/schemas/common";
import { habitSchema } from "@/server/schemas/habits";
import { deleteHabit, getHabit, getLogMaps, summarise, toDef, updateHabit } from "@/server/services/habits";

type Params = { id: string };

export const GET = apiRoute<Params>(async ({ userId, today }, params) => {
  const habitId = readParam(params.id, id);
  const habit = await getHabit(userId, habitId);
  const logs = (await getLogMaps(userId, [habit.id], addLocalDays(today, -400), today)).get(habit.id) ?? new Map();
  const def = toDef(habit);
  const recentDays = Array.from({ length: 14 }, (_, i) => addLocalDays(today, -i))
    .filter((d) => d >= habit.startedOn)
    .map((date) => ({ date, state: dayState(def, logs, date, today), value: logs.get(date) ?? 0 }));
  return ok({
    habit: habitSummaryDto(summarise(habit, logs, today)),
    thread90: thread(def, logs, today, 90).map(tickDto),
    weeklyAverages: habit.kind === "reduce" ? weeklyAverages(def, logs, today, 12) : [],
    recentDays,
  });
});

export const PATCH = apiRoute<Params>(async ({ req, userId }, params) => {
  const habitId = readParam(params.id, id);
  const input = await readJson(req, habitSchema);
  return ok(habitDto(await updateHabit(userId, habitId, input)));
});

export const DELETE = apiRoute<Params>(async ({ userId }, params) => {
  await deleteHabit(userId, readParam(params.id, id));
  return new Response(null, { status: 204 });
});
