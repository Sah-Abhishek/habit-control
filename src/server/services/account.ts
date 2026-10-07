import "server-only";
import { and, eq } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { db } from "@/server/db";
import { account, user } from "@/server/db/schema";
import { UserFacingError } from "@/server/result";

/**
 * Permanently deletes the user. Every app table references user.id with ON DELETE
 * CASCADE, so this removes all personal data, sessions and credentials in one statement.
 * Requires the typed email and the current password as a deliberate re-check.
 */
export async function deleteAccount(userId: string, confirmEmail: string, password: string): Promise<void> {
  const row = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { email: true } });
  if (!row) throw new UserFacingError("This account no longer exists.");
  if (row.email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
    throw new UserFacingError("The email doesn’t match this account.", { email: "Type your account email exactly" });
  }
  const credential = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "credential")),
    columns: { password: true },
  });
  if (!credential?.password || !(await verifyPassword({ hash: credential.password, password }))) {
    throw new UserFacingError("That password isn’t right.", { password: "Check your current password" });
  }
  await db.delete(user).where(eq(user.id, userId));
}
