import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { account, days, habitLogs, habits, session, studySessions, user, userSettings } from "@/server/db/schema";
import { UserFacingError } from "@/server/result";
import { createTestUser } from "@/test/db";
import { deleteAccount } from "./account";

async function withPassword(userId: string, password: string) {
  await db.insert(account).values({ id: `acc-${userId}`, accountId: userId, providerId: "credential", userId, password: await hashPassword(password) });
}

describe("deleteAccount", () => {
  it("requires the matching email and password", async () => {
    const u = await createTestUser();
    await withPassword(u, "right-password-123");
    const email = `${u}@test.local`;
    await expect(deleteAccount(u, "other@test.local", "right-password-123")).rejects.toBeInstanceOf(UserFacingError);
    await expect(deleteAccount(u, email, "wrong-password")).rejects.toBeInstanceOf(UserFacingError);
    expect(await db.query.user.findFirst({ where: eq(user.id, u) })).toBeTruthy();
  });

  it("cascades to every table and leaves other users untouched", async () => {
    const u = await createTestUser();
    const other = await createTestUser();
    await withPassword(u, "right-password-123");
    for (const id of [u, other]) {
      await db.insert(userSettings).values({ userId: id });
      const [h] = await db.insert(habits).values({ userId: id, name: "Run", startedOn: "2026-10-01" }).returning();
      await db.insert(habitLogs).values({ userId: id, habitId: h.id, localDate: "2026-10-02", value: 1 });
      await db.insert(days).values({ userId: id, localDate: "2026-10-02", mood: 7 });
      await db.insert(studySessions).values({ userId: id, startedAt: new Date(), endedAt: new Date(), localDate: "2026-10-02", durationSeconds: 60 });
    }
    await db.insert(session).values({ id: `s-${u}`, token: `t-${u}`, userId: u, expiresAt: new Date(Date.now() + 1e6) });

    // Email match is case-insensitive and ignores surrounding spaces.
    await deleteAccount(u, `  ${u}@TEST.LOCAL `, "right-password-123");

    for (const t of [habits, habitLogs, days, studySessions, userSettings, session, account]) {
      expect(await db.select().from(t).where(eq(t.userId, u))).toHaveLength(0);
    }
    expect(await db.select().from(habits).where(eq(habits.userId, other))).toHaveLength(1);
    expect(await db.select().from(days).where(eq(days.userId, other))).toHaveLength(1);
  });
});
