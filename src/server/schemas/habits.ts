import { z } from "zod";
import { id, localDate, optionalId } from "./common";

export const habitSchema = z
  .object({
    name: z.string().trim().min(1, "Give the habit a name").max(80, "Keep it under 80 characters"),
    kind: z.enum(["build", "reduce"]),
    tracking: z.enum(["binary", "quantity", "duration", "numeric"]),
    target: z.coerce.number().min(0, "Can’t be negative").max(100_000, "That’s too large"),
    unit: z.string().trim().max(20, "Keep units short").nullish(),
    scheduleDays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one day"),
    baseline: z.coerce.number().min(0, "Can’t be negative").max(100_000).nullish(),
    isSensitive: z.boolean().default(false),
    goalId: optionalId,
  })
  .superRefine((v, ctx) => {
    if (v.kind === "build" && v.tracking !== "binary" && v.target <= 0) {
      ctx.addIssue({ code: "custom", path: ["target"], message: "Set a daily target above zero" });
    }
  });

export const logHabitSchema = z.object({
  habitId: id,
  /** Defaults to today in the user's timezone. */
  date: localDate.optional(),
  mode: z.enum(["set", "increment"]),
  value: z.coerce.number().min(-100_000).max(100_000),
});
