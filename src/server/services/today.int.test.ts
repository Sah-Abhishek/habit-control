import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { studySessions, tasks } from "@/server/db/schema";
import { createTestUser } from "@/test/db";
import { saveCheckIn } from "./days";
import { createHabit, logHabit } from "./habits";
import { aggregateDays } from "./today";

const TODAY = "2026-10-07";
const opts = { today: TODAY, timeZone: "UTC", studyTargetMin: 60 };

describe("aggregateDays", () => {
  it("combines study, habits, tasks and check-ins per day without leaking other users", async () => {
    const u = await createTestUser();
    const other = await createTestUser();
    const run = await createHabit(u, { name: "Run", kind: "build", tracking: "binary", target: 1, scheduleDays: [0, 1, 2, 3, 4, 5, 6], isSensitive: false }, "2026-10-05");
    const scroll = await createHabit(u, { name: "Scroll", kind: "reduce", tracking: "quantity", target: 2, baseline: 4, scheduleDays: [0, 1, 2, 3, 4, 5, 6], isSensitive: true }, "2026-10-05");
    await logHabit(u, run.id, "2026-10-06", "set", 1, TODAY);
    await logHabit(u, scroll.id, "2026-10-06", "set", 5, TODAY);
    await db.insert(studySessions).values({ userId: u, localDate: "2026-10-06", startedAt: new Date("2026-10-06T08:00:00Z"), endedAt: new Date("2026-10-06T09:30:00Z"), durationSeconds: 5400 });
    await db.insert(studySessions).values({ userId: other, localDate: "2026-10-06", startedAt: new Date("2026-10-06T08:00:00Z"), endedAt: new Date("2026-10-06T12:00:00Z"), durationSeconds: 14400 });
    await db.insert(tasks).values({ userId: u, title: "PYQ set", dueDate: "2026-10-06", completedAt: new Date("2026-10-06T15:00:00Z") });
    await saveCheckIn(u, "2026-10-06", { mood: 8 }, TODAY);

    const [mon, tue, wed, thu] = await aggregateDays(u, "2026-10-05", "2026-10-08", opts);
    expect(tue).toMatchObject({ studySeconds: 5400, studyTargetMet: true, habitsScheduled: 2, habitsSucceeded: 1, reduceOver: true, tasksDue: 1, tasksCompleted: 1, completedTaskTitles: ["PYQ set"] });
    expect(tue.day?.mood).toBe(8);
    expect(tue.score).toBeGreaterThan(0.5);
    expect(mon.score).toBeLessThan(0.5); // habits scheduled, nothing done, no study
    expect(wed.isFuture).toBe(false);
    expect(thu).toMatchObject({ isFuture: true, score: null });
  });

  it("returns no score before the account existed", async () => {
    const u = await createTestUser();
    const [d] = await aggregateDays(u, "2026-09-01", "2026-09-01", { ...opts, accountCreated: "2026-10-01" });
    expect(d.score).toBeNull();
  });
});
