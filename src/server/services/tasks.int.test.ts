import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { subjects, tasks, topics } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/result";
import { addLocalDays, localDateIn } from "@/domain/dates";
import { createTestUser } from "@/test/db";
import { createGoal } from "./goals";
import { createTask, deleteTask, listTasks, listTasksForDay, setTaskDone, updateTask } from "./tasks";

const TODAY = "2026-10-07";

describe("tasks service", () => {
  it("rejects links to another user's goal, subject or topic", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const g = await createGoal(alice, { title: "A", startDate: TODAY, isPrimary: false });
    const [s] = await db.insert(subjects).values({ userId: alice, name: "DBMS" }).returning();
    const [t] = await db.insert(topics).values({ userId: alice, subjectId: s.id, name: "SQL" }).returning();
    await expect(createTask(bob, { title: "x", priority: "low", goalId: g.id })).rejects.toBeInstanceOf(UserFacingError);
    await expect(createTask(bob, { title: "x", priority: "low", subjectId: s.id })).rejects.toBeInstanceOf(UserFacingError);
    await expect(createTask(bob, { title: "x", priority: "low", topicId: t.id })).rejects.toBeInstanceOf(UserFacingError);
    const mine = await createTask(alice, { title: "x", priority: "low", topicId: t.id });
    expect(mine.subjectId).toBe(s.id); // subject inferred from topic
    await expect(setTaskDone(bob, mine.id, true)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteTask(bob, mine.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateTask(bob, mine.id, { title: "y", priority: "low" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a topic from a different subject", async () => {
    const u = await createTestUser();
    const [s1, s2] = await db.insert(subjects).values([{ userId: u, name: "A" }, { userId: u, name: "B" }]).returning();
    const [t] = await db.insert(topics).values({ userId: u, subjectId: s1.id, name: "T" }).returning();
    await expect(createTask(u, { title: "x", priority: "low", subjectId: s2.id, topicId: t.id })).rejects.toBeInstanceOf(UserFacingError);
  });

  it("toggling is idempotent and keeps the first completion time", async () => {
    const u = await createTestUser();
    const t = await createTask(u, { title: "Read", priority: "medium", dueDate: TODAY });
    await setTaskDone(u, t.id, true);
    const [first] = await db.select({ c: tasks.completedAt }).from(tasks).where(eq(tasks.id, t.id));
    await new Promise((r) => setTimeout(r, 20));
    await Promise.all([setTaskDone(u, t.id, true), setTaskDone(u, t.id, true)]);
    const [second] = await db.select({ c: tasks.completedAt }).from(tasks).where(eq(tasks.id, t.id));
    expect(second.c?.getTime()).toBe(first.c?.getTime());
    await setTaskDone(u, t.id, false);
    const [third] = await db.select({ c: tasks.completedAt }).from(tasks).where(eq(tasks.id, t.id));
    expect(third.c).toBeNull();
  });

  it("lists today: overdue + due today + done today, excluding future and undated", async () => {
    // Completion time is "now", so anchor the dates to the real current day (test users default to UTC).
    const now = localDateIn("UTC");
    const u = await createTestUser();
    const overdue = await createTask(u, { title: "old", priority: "low", dueDate: addLocalDays(now, -6) });
    const due = await createTask(u, { title: "now", priority: "critical", dueDate: now });
    await createTask(u, { title: "later", priority: "high", dueDate: addLocalDays(now, 13) });
    await createTask(u, { title: "someday", priority: "low" });
    const done = await createTask(u, { title: "done", priority: "low", dueDate: now });
    await setTaskDone(u, done.id, true);
    const ids = (await listTasksForDay(u, now)).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([overdue.id, due.id, done.id]));
    expect(ids).toHaveLength(3);
    expect((await listTasks(u, "upcoming", now)).map((t) => t.title)).toEqual(["later"]);
    expect((await listTasks(u, "someday", now)).map((t) => t.title)).toEqual(["someday"]);
    expect((await listTasks(u, "completed", now)).map((t) => t.title)).toEqual(["done"]);
  });
});
