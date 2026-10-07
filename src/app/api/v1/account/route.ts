import { apiRoute, readJson } from "@/server/api/handler";
import { deleteAccountSchema } from "@/server/schemas/account";
import { deleteAccount } from "@/server/services/account";

/** Permanently deletes the user and (by cascade) all their data and sessions. */
export const DELETE = apiRoute(async ({ req, userId }) => {
  const { email, password } = await readJson(req, deleteAccountSchema);
  await deleteAccount(userId, email, password);
  return new Response(null, { status: 204 });
});
