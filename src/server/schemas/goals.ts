import { z } from "zod";
import { isLocalDate } from "@/domain/dates";

const requiredDate = z.string().refine(isLocalDate, "Pick a valid date");
const optionalDate = z
  .union([z.string().refine(isLocalDate, "Pick a valid date"), z.literal("")])
  .nullish()
  .transform((v) => v || null);

export const goalSchema = z
  .object({
    title: z.string().trim().min(1, "Give the goal a name").max(120, "Keep it under 120 characters"),
    description: z.string().trim().max(2000, "Keep it under 2000 characters").nullish(),
    startDate: requiredDate,
    targetDate: optionalDate,
    isPrimary: z.boolean().default(false),
  })
  .refine((v) => !v.targetDate || v.targetDate >= v.startDate, { path: ["targetDate"], message: "Pick a date on or after the start date" });

export const milestoneSchema = z.object({
  title: z.string().trim().min(1, "Name the milestone").max(120, "Keep it under 120 characters"),
  targetDate: optionalDate,
  progress: z.coerce.number().min(0, "0–100").max(100, "0–100"),
});

export const goalStatusSchema = z.enum(["active", "paused", "completed", "archived"]);
