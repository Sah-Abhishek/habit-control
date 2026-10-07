import { z } from "zod";

export const deleteAccountSchema = z.object({
  email: z.string().trim().min(1, "Type your account email"),
  password: z.string().min(1, "Enter your current password").max(128),
});
