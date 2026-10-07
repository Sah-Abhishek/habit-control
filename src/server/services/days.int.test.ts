import { describe, expect, it } from "vitest";
import { createTestUser } from "@/test/db";
import { UserFacingError } from "@/server/result";
import { getDay, getDaysInRange, resolveSleepWindow, saveCheckIn, saveFocus, saveSleep } from "./days";

const TODAY = "2026-10-07";
const TZ = "Asia/Kolkata";

describe("days service", () => {
  it("check-in upserts are idempotent and partial", async () => {
    const u = await createTestUser();
    await saveCheckIn(u, TODAY, { mood: 7 }, TODAY);
    await saveCheckIn(u, TODAY, { mood: 7 }, TODAY);
    await saveCheckIn(u, TODAY, { energy: 5 }, TODAY);
    const rows = await getDaysInRange(u, TODAY, TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mood: 7, energy: 5, stress: null });
    await saveCheckIn(u, TODAY, { mood: null }, TODAY);
    expect((await getDay(u, TODAY))?.mood).toBeNull();
  });

  it("rejects future days", async () => {
    const u = await createTestUser();
    await expect(saveCheckIn(u, "2026-10-08", { mood: 5 }, TODAY)).rejects.toBeInstanceOf(UserFacingError);
  });

  it("resolves sleep crossing midnight onto the previous evening", () => {
    const { start, end } = resolveSleepWindow(TODAY, "23:40", "07:10", TZ);
    expect(start.toISOString()).toBe("2026-10-06T18:10:00.000Z");
    expect(end.toISOString()).toBe("2026-10-07T01:40:00.000Z");
  });

  it("keeps a post-midnight bed time on the same day", () => {
    const { start, end } = resolveSleepWindow(TODAY, "00:40", "07:20", TZ);
    expect((end.getTime() - start.getTime()) / 60000).toBe(400);
  });

  it("rejects equal times and implausibly long nights", () => {
    expect(() => resolveSleepWindow(TODAY, "07:00", "07:00", TZ)).toThrow(UserFacingError);
    expect(() => resolveSleepWindow(TODAY, "12:00", "06:00", TZ)).toThrow(/more than 16 hours/);
    expect(() => resolveSleepWindow(TODAY, "7:00", "08:00", TZ)).toThrow(UserFacingError);
  });

  it("measures DST nights in the user's timezone", () => {
    // Europe clocks go back on 25 Oct 2026: 23:00 → 07:00 is 9 hours that night.
    const { start, end } = resolveSleepWindow("2026-10-25", "23:00", "07:00", "Europe/Berlin");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(9);
  });

  it("saves sleep and keeps other fields", async () => {
    const u = await createTestUser();
    await saveCheckIn(u, "2026-10-01", { mood: 8 }, TODAY);
    await saveSleep(u, "2026-10-01", { bed: "23:30", wake: "06:45", quality: 7 }, TZ, TODAY);
    const d = await getDay(u, "2026-10-01");
    expect(d).toMatchObject({ mood: 8, sleepQuality: 7 });
    expect(d?.sleepStart).toBeInstanceOf(Date);
  });

  it("does not let a user focus on someone else's topic", async () => {
    const u = await createTestUser();
    await expect(saveFocus(u, TODAY, { topicId: "00000000-0000-4000-8000-000000000000", text: null }, TODAY)).rejects.toBeInstanceOf(UserFacingError);
    const d = await saveFocus(u, TODAY, { topicId: null, text: "  Revise joins " }, TODAY);
    expect(d.focusText).toBe("Revise joins");
  });

  it("isolates users", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await saveCheckIn(a, TODAY, { mood: 3 }, TODAY);
    expect(await getDay(b, TODAY)).toBeNull();
  });
});
