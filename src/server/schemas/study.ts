import { z } from "zod";
import { isLocalDate } from "@/domain/dates";
import { STUDY_METHODS } from "@/domain/study";

const id = z.string().uuid("Invalid id");
const optionalId = id.nullish().or(z.literal("").transform(() => null));
const localDate = z.string().refine(isLocalDate, "Invalid date");
export const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const method = z.enum(STUDY_METHODS).nullish().or(z.literal("").transform(() => null));
const optionalCount = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int("Whole numbers only").min(0, "Can’t be negative").max(10_000).nullable());

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Give the subject a name").max(80, "Keep it under 80 characters"),
  goalId: optionalId,
  weight: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int("Whole numbers only").min(0, "0–100").max(100, "0–100").nullable()),
});

export const topicName = z.string().trim().min(1, "Give the topic a name").max(120, "Keep it under 120 characters");
export const topicProgress = z.coerce.number().int().min(0, "0–100").max(100, "0–100");

export const startSessionSchema = z.object({ subjectId: optionalId, topicId: optionalId, method });
export const tallySchema = z.object({ result: z.enum(["correct", "missed", "undo-correct", "undo-missed"]) });

export const detailsSchema = z
  .object({
    subjectId: optionalId,
    topicId: optionalId,
    method,
    focus: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(5).nullable()),
    questionsAttempted: optionalCount,
    questionsCorrect: optionalCount,
    // Blank clears the note (native clients omit nulls, so they send "" to erase).
    notes: z
      .string()
      .max(2000, "Keep notes under 2000 characters")
      .transform((v) => (v.trim() === "" ? null : v))
      .nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.questionsCorrect != null && (v.questionsAttempted == null || v.questionsCorrect > v.questionsAttempted)) {
      ctx.addIssue({ code: "custom", path: ["questionsCorrect"], message: "Can’t be more than attempted" });
    }
  });

export const timesSchema = z.object({ date: localDate, startTime: clockTime, endTime: clockTime });
