import { describe, expect, it } from "vitest";
import { createTestUser } from "@/test/db";
import { NotFoundError, UserFacingError } from "@/server/result";
import { createHabit, getHabit, getLogMaps, habitSummaries, logHabit } from "./habits";

const TODAY = "2026-10-07";
const base = { kind: "build" as const, tracking: "binary" as const, target: 1, scheduleDays: [0, 1, 2, 3, 4, 5, 6], isSensitive: false };

describe("habits service", () => {
  it("never exposes another user's habit", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const h = await createHabit(alice, { ...base, name: "Run" }, TODAY);
    await expect(getHabit(bob, h.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(logHabit(bob, h.id, TODAY, "set", 1, TODAY)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("set is idempotent and setting 0 removes the log", async () => {
    const u = await createTestUser();
    const h = await createHabit(u, { ...base, name: "Read" }, TODAY);
    await logHabit(u, h.id, TODAY, "set", 1, TODAY);
    const second = await logHabit(u, h.id, TODAY, "set", 1, TODAY);
    expect(second).toEqual({ value: 1, previous: 1 });
    await logHabit(u, h.id, TODAY, "set", 0, TODAY);
    expect((await getLogMaps(u, [h.id], TODAY, TODAY)).get(h.id)?.size).toBe(0);
  });

  it("concurrent increments all count (two tabs, double taps)", async () => {
    const u = await createTestUser();
    const h = await createHabit(u, { ...base, kind: "reduce", tracking: "quantity", target: 3, baseline: 4, name: "Scrolling" }, TODAY);
    await Promise.all(Array.from({ length: 5 }, () => logHabit(u, h.id, TODAY, "increment", 1, TODAY)));
    expect((await getLogMaps(u, [h.id], TODAY, TODAY)).get(h.id)?.get(TODAY)).toBe(5);
    const dec = await logHabit(u, h.id, TODAY, "increment", -10, TODAY);
    expect(dec.value).toBe(0);
  });

  it("rejects future dates", async () => {
    const u = await createTestUser();
    const h = await createHabit(u, { ...base, name: "Stretch" }, TODAY);
    await expect(logHabit(u, h.id, "2026-10-08", "set", 1, TODAY)).rejects.toBeInstanceOf(UserFacingError);
  });

  it("forces reduce habits to quantity tracking and summarises them", async () => {
    const u = await createTestUser();
    const h = await createHabit(u, { ...base, kind: "reduce", tracking: "binary", target: 2, baseline: 5, name: "Sugar" }, TODAY);
    expect(h.tracking).toBe("quantity");
    const [s] = await habitSummaries(u, TODAY);
    expect(s.reduction).not.toBeNull();
  });
});
