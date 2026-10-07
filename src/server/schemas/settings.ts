import { z } from "zod";
import { isValidTimeZone } from "@/domain/dates";

export const timezoneSchema = z.string().max(64).refine(isValidTimeZone, "Unknown timezone");

export const settingsSchema = z.object({
  timezone: timezoneSchema.optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
  weekStartsOn: z.coerce.number().int().min(0).max(6).optional(),
  dailyStudyTargetMin: z.coerce.number().int().min(0, "Can’t be negative").max(24 * 60, "That’s more than a day").optional(),
  revisionScheduleDays: z
    .array(z.coerce.number().int().min(1).max(365))
    .min(1, "Add at least one interval")
    .max(10, "Use at most 10 intervals")
    .refine((a) => a.every((v, i) => i === 0 || v > a[i - 1]), "Intervals must increase")
    .optional(),
  quietMode: z.boolean().optional(),
});
