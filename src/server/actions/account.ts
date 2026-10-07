"use server";

import { cookies } from "next/headers";
import { requireUser } from "@/server/auth/session";
import { runAction } from "@/server/result";
import { deleteAccountSchema } from "@/server/schemas/account";
import { deleteAccount } from "@/server/services/account";

export async function deleteAccountAction(input: unknown) {
  const user = await requireUser();
  return runAction("deleteAccount", deleteAccountSchema, input, async ({ email, password }) => {
    await deleteAccount(user.id, email, password);
    // Sessions were removed by the cascade; also clear the now-dead auth cookies.
    const jar = await cookies();
    for (const c of jar.getAll()) {
      if (c.name.startsWith("better-auth.") || c.name.startsWith("__Secure-better-auth.")) jar.delete(c.name);
    }
  });
}
