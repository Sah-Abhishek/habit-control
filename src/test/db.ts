import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

/** Creates an isolated user; every test works inside its own user's data. */
export async function createTestUser(name = "Test"): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({ id, name, email: `${id}@test.local` });
  return id;
}
