import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { goals } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/result";
import { createTestUser } from "@/test/db";
import {
  createGoal,
  createMilestone,
  getGoal,
  getPrimaryGoalSummary,
  listGoalCards,
  moveMilestone,
  setGoalStatus,
  setMilestoneComplete,
  setPrimaryGoal,
  updateGoal,
} from "./goals";

const TODAY = "2026-10-07";
const input = (title: string, isPrimary = false) => ({ title, startDate: "2026-01-01", targetDate: "2027-01-01", isPrimary });

async function primaries(userId: string) {
  return db.select({ id: goals.id }).from(goals).where(and(eq(goals.userId, userId), eq(goals.isPrimary, true)));
}

describe("goals service", () => {
  it("never exposes another user's goal or milestones", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const g = await createGoal(alice, input("GATE"));
    await expect(getGoal(bob, g.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createMilestone(bob, g.id, { title: "x", progress: 0 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(setPrimaryGoal(bob, g.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await getPrimaryGoalSummary(bob, TODAY)).toBeNull();
  });

  it("keeps exactly one main goal, even when switched concurrently", async () => {
    const u = await createTestUser();
    const a = await createGoal(u, input("A", true));
    const b = await createGoal(u, input("B"));
    const c = await createGoal(u, input("C"));
    await Promise.all([setPrimaryGoal(u, b.id), setPrimaryGoal(u, c.id), updateGoal(u, a.id, input("A", true))]);
    expect(await primaries(u)).toHaveLength(1);
    await createGoal(u, input("D", true));
    const p = await primaries(u);
    expect(p).toHaveLength(1);
  });

  it("rejects a target before the start", async () => {
    const u = await createTestUser();
    await expect(createGoal(u, { title: "x", startDate: "2026-05-01", targetDate: "2026-04-01", isPrimary: false })).rejects.toBeInstanceOf(UserFacingError);
  });

  it("completing a goal clears the main flag; summary falls back to latest active goal", async () => {
    const u = await createTestUser();
    const a = await createGoal(u, input("A", true));
    const b = await createGoal(u, input("B"));
    expect((await getPrimaryGoalSummary(u, TODAY))?.id).toBe(a.id);
    await setGoalStatus(u, a.id, "completed");
    expect(await primaries(u)).toHaveLength(0);
    expect((await getPrimaryGoalSummary(u, TODAY))?.id).toBe(b.id);
    await expect(setPrimaryGoal(u, a.id)).rejects.toBeInstanceOf(UserFacingError);
  });

  it("averages milestone progress, completes idempotently and reorders", async () => {
    const u = await createTestUser();
    const g = await createGoal(u, input("G", true));
    const m1 = await createMilestone(u, g.id, { title: "One", progress: 50 });
    const m2 = await createMilestone(u, g.id, { title: "Two", progress: 0 });
    await setMilestoneComplete(u, m2.id, true);
    await setMilestoneComplete(u, m2.id, true);
    const s = await getPrimaryGoalSummary(u, TODAY);
    expect(s?.progress).toBeCloseTo(0.75);
    expect(s?.milestones.map((m) => m.title)).toEqual(["One", "Two"]);
    await moveMilestone(u, m2.id, "up");
    await moveMilestone(u, m2.id, "up"); // no-op at top
    expect((await getPrimaryGoalSummary(u, TODAY))?.milestones.map((m) => m.id)).toEqual([m2.id, m1.id]);
    const [card] = await listGoalCards(u, TODAY);
    expect(card.completedMilestones).toBe(1);
  });
});
