import { z } from "zod";
import { isLocalDate } from "@/domain/dates";

const optionalId = z
  .union([z.string().uuid(), z.literal("")])
  .nullish()
  .transform((v) => v || null);

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200, "Keep it under 200 characters"),
  notes: z.string().trim().max(2000, "Keep notes under 2000 characters").nullish(),
  dueDate: z
    .union([z.string().refine(isLocalDate, "Invalid date"), z.literal("")])
    .nullish()
    .transform((v) => v || null),
  priority: z.enum(["low", "medium", "high", "critical"]),
  goalId: optionalId,
  subjectId: optionalId,
  topicId: optionalId,
  estimateMinutes: z
    .union([z.coerce.number().int("Use whole minutes").min(1, "At least 1 minute").max(24 * 60, "That’s more than a day"), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
});

export const taskDoneSchema = z.object({ done: z.boolean() });
export const taskFilterSchema = z.enum(["today", "upcoming", "someday", "completed"]);
