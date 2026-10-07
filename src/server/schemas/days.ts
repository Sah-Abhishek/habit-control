import { z } from "zod";
import { isLocalDate } from "@/domain/dates";

const localDate = z.string().refine(isLocalDate, "Invalid date");
const scale = z.coerce.number().int().min(1, "Use 1–10").max(10, "Use 1–10").nullable();
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const checkInPatchSchema = z.object({
  mood: scale.optional(),
  energy: scale.optional(),
  stress: scale.optional(),
  note: z.string().max(2000, "Keep notes under 2000 characters").nullable().optional(),
});
export const sleepSchema = z.object({ bed: clock, wake: clock, quality: scale.optional() });
export const focusSchema = z.object({
  topicId: z.string().uuid().nullable(),
  text: z.string().trim().max(140, "Keep it under 140 characters").nullable(),
});
export { localDate as dayDate };
