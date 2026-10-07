import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { revisions, studySessions } from "@/server/db/schema";
import { NotFoundError, UserFacingError } from "@/server/result";
import { createTestUser } from "@/test/db";
import {
  createSubject,
  createTopic,
  editSessionTimes,
  finishSession,
  getRunningSession,
  logPastSession,
  moveTopic,
  pauseSession,
  resumeSession,
  revisionsDue,
  setTopicCompleted,
  startSession,
  studySecondsByDay,
  tallySession,
  listTopics,
} from "./study";

const TODAY = "2026-10-07";

describe("study sessions", () => {
  it("allows only one running session even under concurrent starts", async () => {
    const u = await createTestUser();
    const results = await Promise.all(Array.from({ length: 5 }, () => startSession(u, {})));
    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);
    const rows = await db.select().from(studySessions).where(eq(studySessions.userId, u));
    expect(rows).toHaveLength(1);
  });

  it("excludes paused time and is idempotent on finish", async () => {
    const u = await createTestUser();
    const t0 = new Date("2026-10-07T08:00:00Z");
    const { id } = await startSession(u, {}, t0);
    await pauseSession(u, id, new Date("2026-10-07T08:20:00Z"));
    await pauseSession(u, id, new Date("2026-10-07T08:21:00Z")); // second pause is a no-op
    await resumeSession(u, id, new Date("2026-10-07T08:30:00Z"));
    const done = await finishSession(u, id, new Date("2026-10-07T09:00:00Z"));
    expect(done.durationSeconds).toBe(50 * 60);
    const again = await finishSession(u, id, new Date("2026-10-07T10:00:00Z"));
    expect(again.durationSeconds).toBe(50 * 60);
    expect(await getRunningSession(u)).toBeNull();
  });

  it("persists tallies and keeps correct <= attempted", async () => {
    const u = await createTestUser();
    const { id } = await startSession(u, {});
    await tallySession(u, id, "correct");
    await tallySession(u, id, "missed");
    expect(await tallySession(u, id, "undo-missed")).toEqual({ attempted: 1, correct: 1 });
    expect(await tallySession(u, id, "undo-missed")).toEqual({ attempted: 1, correct: 1 });
  });

  it("rejects linking to another user's topic, or a topic from a different subject", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const s1 = await createSubject(alice, { name: "DBMS" });
    const s2 = await createSubject(alice, { name: "OS" });
    const t1 = await createTopic(alice, s1.id, "Transactions");
    await expect(startSession(bob, { topicId: t1.id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(startSession(alice, { subjectId: s2.id, topicId: t1.id })).rejects.toBeInstanceOf(UserFacingError);
    const ok = await startSession(alice, { topicId: t1.id });
    const running = await getRunningSession(alice);
    expect(running?.id).toBe(ok.id);
    expect(running?.subjectId).toBe(s1.id);
  });

  it("validates edited times and supports sessions past midnight", async () => {
    const u = await createTestUser();
    const { id } = await logPastSession(u, { date: "2026-10-05", startTime: "23:30", endTime: "00:30" });
    const day = await studySecondsByDay(u, "2026-10-05", "2026-10-06");
    expect(day.get("2026-10-05")).toBe(3600);
    await expect(editSessionTimes(u, id, { date: "2026-10-05", startTime: "01:00", endTime: "20:00" })).rejects.toBeInstanceOf(UserFacingError);
    await expect(logPastSession(u, { date: "2099-01-01", startTime: "08:00", endTime: "09:00" })).rejects.toBeInstanceOf(UserFacingError);
  });
});

describe("topics and revisions", () => {
  it("completing twice never duplicates revisions; reopening removes pending ones", async () => {
    const u = await createTestUser();
    const s = await createSubject(u, { name: "DBMS" });
    const t = await createTopic(u, s.id, "Normalization");
    await setTopicCompleted(u, t.id, true, TODAY);
    await setTopicCompleted(u, t.id, true, TODAY);
    const rows = await db.select().from(revisions).where(eq(revisions.topicId, t.id));
    expect(rows.map((r) => r.step).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(await revisionsDue(u, "2026-10-08")).toHaveLength(1);
    await setTopicCompleted(u, t.id, false, TODAY);
    expect(await db.select().from(revisions).where(and(eq(revisions.topicId, t.id)))).toHaveLength(0);
  });

  it("only surfaces the earliest outstanding revision step per topic", async () => {
    const u = await createTestUser();
    const s = await createSubject(u, { name: "CN" });
    const t = await createTopic(u, s.id, "OSI model");
    await setTopicCompleted(u, t.id, true, TODAY);
    // 60 days later every step is past due, but only Rev 1 should be shown.
    const due = await revisionsDue(u, "2026-12-06");
    expect(due.map((d) => d.step)).toEqual([1]);
  });

  it("reorders topics", async () => {
    const u = await createTestUser();
    const s = await createSubject(u, { name: "OS" });
    const a = await createTopic(u, s.id, "A");
    await createTopic(u, s.id, "B");
    await moveTopic(u, a.id, "down");
    expect((await listTopics(u, s.id)).map((t) => t.name)).toEqual(["B", "A"]);
    await moveTopic(u, a.id, "down"); // already last — no-op
    expect((await listTopics(u, s.id)).map((t) => t.name)).toEqual(["B", "A"]);
  });
});
