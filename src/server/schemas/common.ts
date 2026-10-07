import { z } from "zod";
import { isLocalDate } from "@/domain/dates";

export const id = z.string().uuid("Invalid id");
export const localDate = z.string().refine(isLocalDate, "Use a YYYY-MM-DD date");
/** Accepts "" from HTML selects as "no value". */
export const optionalId = id.nullish().or(z.literal("").transform(() => null));
