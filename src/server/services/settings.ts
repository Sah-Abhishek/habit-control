import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { localDateIn, type LocalDate } from "@/domain/dates";
import { db } from "@/server/db";
import { userSettings } from "@/server/db/schema";

export type Settings = typeof userSettings.$inferSelect;

/**
 * Settings row for the user, created with defaults on first access. Memoised per
 * request because almost every page needs the timezone.
 */
export const getSettings = cache(async (userId: string): Promise<Settings> => {
  const existing = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  if (existing) return existing;
  await db.insert(userSettings).values({ userId }).onConflictDoNothing();
  const created = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  if (!created) throw new Error("Failed to initialise user settings");
  return created;
});

/** "Today" as a calendar day in the user's timezone. */
export async function getToday(userId: string): Promise<{ today: LocalDate; settings: Settings }> {
  const settings = await getSettings(userId);
  return { today: localDateIn(settings.timezone), settings };
}

export type SettingsPatch = Partial<
  Pick<Settings, "timezone" | "theme" | "weekStartsOn" | "dailyStudyTargetMin" | "revisionScheduleDays" | "quietMode" | "onboardedAt">
>;

export async function updateSettings(userId: string, patch: SettingsPatch): Promise<Settings> {
  await getSettings(userId);
  const [row] = await db.update(userSettings).set(patch).where(eq(userSettings.userId, userId)).returning();
  return row;
}
