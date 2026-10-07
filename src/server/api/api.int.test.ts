import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as accountRoute from "@/app/api/v1/account/route";
import * as calendarRoute from "@/app/api/v1/calendar/route";
import * as dayCheckInRoute from "@/app/api/v1/days/[date]/check-in/route";
import * as dayFocusRoute from "@/app/api/v1/days/[date]/focus/route";
import * as daySleepRoute from "@/app/api/v1/days/[date]/sleep/route";
import * as goalRoute from "@/app/api/v1/goals/[id]/route";
import * as goalsRoute from "@/app/api/v1/goals/route";
import * as habitLogRoute from "@/app/api/v1/habits/[id]/logs/[date]/route";
import * as habitsRoute from "@/app/api/v1/habits/route";
import * as insightsRoute from "@/app/api/v1/insights/route";
import * as meRoute from "@/app/api/v1/me/route";
import * as reviewRoute from "@/app/api/v1/review/weekly/route";
import * as sessionFinishRoute from "@/app/api/v1/sessions/[id]/finish/route";
import * as sessionRoute from "@/app/api/v1/sessions/[id]/route";
import * as sessionsRoute from "@/app/api/v1/sessions/route";
import * as settingsRoute from "@/app/api/v1/settings/route";
import * as studyRoute from "@/app/api/v1/study/route";
import * as subjectsRoute from "@/app/api/v1/subjects/route";
import * as taskDoneRoute from "@/app/api/v1/tasks/[id]/done/route";
import * as tasksRoute from "@/app/api/v1/tasks/route";
import * as todayRoute from "@/app/api/v1/today/route";
import { auth } from "@/server/auth/auth";
import { getToday } from "@/server/services/settings";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function signUp(): Promise<{ token: string; email: string; password: string; userId: string }> {
  const email = `api-${randomUUID()}@test.local`;
  const password = "correct-horse-battery";
  const { headers, response } = await auth.api.signUpEmail({ body: { name: "API Test", email, password }, returnHeaders: true });
  const token = headers.get("set-auth-token");
  if (!token) throw new Error("no token");
  return { token, email, password, userId: response.user.id };
}

async function call(handler: Handler, method: string, path: string, opts: { token?: string; body?: unknown; params?: Record<string, string>; headers?: Record<string, string> } = {}) {
  const headers = new Headers(opts.headers);
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  const req = new Request(`http://localhost:3000/api/v1/${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
}

const habitBody = { name: "Read", kind: "build", tracking: "binary", target: 1, scheduleDays: [0, 1, 2, 3, 4, 5, 6], isSensitive: false };

describe("API v1 auth", () => {
  it("rejects requests without a bearer token", async () => {
    const r = await call(meRoute.GET as Handler, "GET", "me");
    expect(r.status).toBe(401);
    expect(r.json.error.code).toBe("unauthorized");
  });

  it("ignores session cookies (CSRF-proof)", async () => {
    const { token } = await signUp();
    const r = await call(meRoute.GET as Handler, "GET", "me", { headers: { cookie: `better-auth.session_token=${token}` } });
    expect(r.status).toBe(401);
  });

  it("accepts a valid bearer token", async () => {
    const { token, email } = await signUp();
    const r = await call(meRoute.GET as Handler, "GET", "me", { token });
    expect(r.status).toBe(200);
    expect(r.json.user.email).toBe(email);
    expect(r.json.settings).toMatchObject({ theme: "system", onboarded: false });
  });
});

describe("API v1 ownership and validation", () => {
  it("returns 404 for another user's resources", async () => {
    const a = await signUp();
    const b = await signUp();
    const created = await call(goalsRoute.POST as Handler, "POST", "goals", { token: a.token, body: { title: "Mine", startDate: "2026-01-01" } });
    expect(created.status).toBe(201);
    const other = await call(goalRoute.GET as Handler, "GET", `goals/${created.json.id}`, { token: b.token, params: { id: created.json.id } });
    expect(other.status).toBe(404);
    const del = await call(goalRoute.DELETE as Handler, "DELETE", `goals/${created.json.id}`, { token: b.token, params: { id: created.json.id } });
    expect(del.status).toBe(404);
  });

  it("returns 400 with field errors for invalid bodies", async () => {
    const { token } = await signUp();
    const r = await call(tasksRoute.POST as Handler, "POST", "tasks", { token, body: { title: "", priority: "urgent" } });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe("validation");
    expect(r.json.error.fieldErrors).toHaveProperty("title");
    expect(r.json.error.fieldErrors).toHaveProperty("priority");
  });

  it("returns 404 for malformed ids", async () => {
    const { token } = await signUp();
    const r = await call(goalRoute.GET as Handler, "GET", "goals/nope", { token, params: { id: "nope" } });
    expect(r.status).toBe(404);
  });
});

describe("API v1 idempotent replays (offline outbox)", () => {
  it("habit log PUT, task done PUT, check-in PATCH, sleep PUT and focus PUT can be replayed", async () => {
    const { token, userId } = await signUp();
    const { today } = await getToday(userId);

    const habit = await call(habitsRoute.POST as Handler, "POST", "habits", { token, body: habitBody });
    for (let i = 0; i < 2; i++) {
      const r = await call(habitLogRoute.PUT as Handler, "PUT", `habits/${habit.json.id}/logs/${today}`, { token, body: { value: 1 }, params: { id: habit.json.id, date: today } });
      expect(r.status).toBe(200);
      expect(r.json.value).toBe(1);
    }

    const task = await call(tasksRoute.POST as Handler, "POST", "tasks", { token, body: { title: "Revise", priority: "high", dueDate: today } });
    expect(task.status).toBe(201);
    expect(task.json).toMatchObject({ title: "Revise", completedAt: null, overdue: false });
    const first = await call(taskDoneRoute.PUT as Handler, "PUT", `tasks/${task.json.id}/done`, { token, body: { done: true }, params: { id: task.json.id } });
    const listed1 = await call(tasksRoute.GET as Handler, "GET", "tasks?filter=today", { token });
    await call(taskDoneRoute.PUT as Handler, "PUT", `tasks/${task.json.id}/done`, { token, body: { done: true }, params: { id: task.json.id } });
    const listed2 = await call(tasksRoute.GET as Handler, "GET", "tasks?filter=today", { token });
    expect(first.json).toEqual({ done: true });
    expect(listed2.json.tasks[0].completedAt).toBe(listed1.json.tasks[0].completedAt);

    for (let i = 0; i < 2; i++) {
      const c = await call(dayCheckInRoute.PATCH as Handler, "PATCH", `days/${today}/check-in`, { token, body: { mood: 7 }, params: { date: today } });
      expect(c.status).toBe(200);
      expect(c.json).toMatchObject({ date: today, mood: 7, energy: null });
      const s = await call(daySleepRoute.PUT as Handler, "PUT", `days/${today}/sleep`, { token, body: { bed: "23:30", wake: "07:00", quality: 8 }, params: { date: today } });
      expect(s.status).toBe(200);
      expect(s.json.sleep).toMatchObject({ bed: "23:30", wake: "07:00", quality: 8, hours: 7.5 });
      const f = await call(dayFocusRoute.PUT as Handler, "PUT", `days/${today}/focus`, { token, body: { text: "Graphs" }, params: { date: today } });
      expect(f.json.focus).toEqual({ topicId: null, text: "Graphs", label: "Graphs" });
    }
  });

  it("rejects logging the future with a user-facing 422", async () => {
    const { token } = await signUp();
    const habit = await call(habitsRoute.POST as Handler, "POST", "habits", { token, body: habitBody });
    const r = await call(habitLogRoute.PUT as Handler, "PUT", `habits/${habit.json.id}/logs/2099-01-01`, { token, body: { value: 1 }, params: { id: habit.json.id, date: "2099-01-01" } });
    expect(r.status).toBe(422);
    expect(r.json.error.message).toMatch(/hasn’t happened/);
  });
});

describe("API v1 study sessions", () => {
  it("starts once, reports an already-running session, merges partial PATCH, finishes idempotently", async () => {
    const { token } = await signUp();
    const subject = await call(subjectsRoute.POST as Handler, "POST", "subjects", { token, body: { name: "DBMS", weight: 8 } });
    expect(subject.status).toBe(201);
    expect(subject.json).toMatchObject({ name: "DBMS", weight: 8, progress: 0, topicCount: 0, archived: false });

    const started = await call(sessionsRoute.POST as Handler, "POST", "sessions", { token, body: { subjectId: subject.json.id, method: "practice" } });
    expect(started.status).toBe(201);
    expect(started.json).toMatchObject({ subjectName: "DBMS", method: "practice", endedAt: null });
    expect(typeof started.json.elapsedSeconds).toBe("number");
    expect(typeof started.json.serverNow).toBe("string");

    const again = await call(sessionsRoute.POST as Handler, "POST", "sessions", { token, body: {} });
    expect(again.status).toBe(200);
    expect(again.headers.get("x-already-running")).toBe("1");
    expect(again.json.id).toBe(started.json.id);

    const params = { id: started.json.id };
    const f1 = await call(sessionFinishRoute.POST as Handler, "POST", `sessions/${params.id}/finish`, { token, params });
    const f2 = await call(sessionFinishRoute.POST as Handler, "POST", `sessions/${params.id}/finish`, { token, params });
    expect(f1.status).toBe(200);
    expect(f2.json.session.endedAt).toBe(f1.json.session.endedAt);
    expect(f1.json.longSession).toBe(false);

    const patched = await call(sessionRoute.PATCH as Handler, "PATCH", `sessions/${params.id}`, { token, params, body: { focus: 4 } });
    expect(patched.status).toBe(200);
    // Omitted fields keep their values.
    expect(patched.json).toMatchObject({ focus: 4, method: "practice", subjectId: subject.json.id });
    const bad = await call(sessionRoute.PATCH as Handler, "PATCH", `sessions/${params.id}`, { token, params, body: { questionsAttempted: 2, questionsCorrect: 5 } });
    expect(bad.status).toBe(400);
    expect(bad.json.error.fieldErrors).toHaveProperty("questionsCorrect");

    const overview = await call(studyRoute.GET as Handler, "GET", "study", { token });
    expect(overview.json).toMatchObject({ running: null, targetSeconds: 7200 });
    expect(overview.json.recentSessions[0].id).toBe(params.id);
  });
});

describe("API v1 aggregate shapes", () => {
  it("today, calendar, insights and weekly review expose the fields mobile models need", async () => {
    const { token, userId } = await signUp();
    const { today } = await getToday(userId);
    await call(habitsRoute.POST as Handler, "POST", "habits", { token, body: habitBody });

    const t = await call(todayRoute.GET as Handler, "GET", "today", { token });
    expect(t.status).toBe(200);
    expect(t.json).toMatchObject({ today, goalDay: null, goal: null, runningSession: null, observation: null });
    expect(["morning", "afternoon", "evening"]).toContain(t.json.greeting);
    expect(t.json.study).toEqual({ todaySeconds: 0, targetSeconds: 7200 });
    expect(t.json.week).toHaveLength(7);
    expect(t.json.habits[0]).toMatchObject({ name: "Read", today: { value: 0, scheduled: true } });
    expect(t.json.checkIn).toEqual({ mood: null, energy: null, stress: null, note: null, sleep: null });

    const c = await call(calendarRoute.GET as Handler, "GET", `calendar?month=${today.slice(0, 7)}`, { token });
    expect(c.status).toBe(200);
    expect(c.json.days.length).toBeGreaterThanOrEqual(28);
    expect(c.json.days[0]).toHaveProperty("beforeAccount");
    const badMonth = await call(calendarRoute.GET as Handler, "GET", "calendar?month=2026-13", { token });
    expect(badMonth.status).toBe(400);

    const i = await call(insightsRoute.GET as Handler, "GET", "insights?range=7d", { token });
    expect(i.status).toBe(200);
    expect(i.json.kpis).toMatchObject({ studySeconds: 0, consistency: { days: 0, total: 7 }, revisions: { done: 0, due: 0 } });
    expect(i.json.focusByHour).toHaveLength(24);
    expect(i.json.habitThreads[0].ticks.length).toBeGreaterThan(0);

    const r = await call(reviewRoute.GET as Handler, "GET", "review/weekly", { token });
    expect(r.status).toBe(200);
    expect(r.json.study.byDay).toHaveLength(7);
    expect(r.json).toHaveProperty("wentWell");
    expect(r.json).toHaveProperty("needsAttention");
    const future = await call(reviewRoute.GET as Handler, "GET", "review/weekly?week=2099-01-05", { token });
    expect(future.status).toBe(422);
  });

  it("settings PATCH marks onboarding and validates", async () => {
    const { token } = await signUp();
    const ok = await call(settingsRoute.PATCH as Handler, "PATCH", "settings", { token, body: { theme: "dark", onboarded: true } });
    expect(ok.json).toMatchObject({ theme: "dark", onboarded: true });
    const bad = await call(settingsRoute.PATCH as Handler, "PATCH", "settings", { token, body: { timezone: "Mars/Olympus" } });
    expect(bad.status).toBe(400);
    expect(bad.json.error.fieldErrors).toHaveProperty("timezone");
  });

  it("account DELETE checks the password, then removes the user", async () => {
    const { token, email, password } = await signUp();
    const wrong = await call(accountRoute.DELETE as Handler, "DELETE", "account", { token, body: { email, password: "not-the-password" } });
    expect(wrong.status).toBe(422);
    const done = await call(accountRoute.DELETE as Handler, "DELETE", "account", { token, body: { email, password } });
    expect(done.status).toBe(204);
    const after = await call(meRoute.GET as Handler, "GET", "me", { token });
    expect(after.status).toBe(401);
  });
});

describe("API v1 undo endpoints", () => {
  it("reopens a completed revision and restores a snoozed due date (both idempotent)", async () => {
    const { token, userId } = await signUp();
    const { today } = await getToday(userId);
    const { createSubject, createTopic, setTopicCompleted } = await import("@/server/services/study");
    const { db } = await import("@/server/db");
    const { revisions } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const s = await createSubject(userId, { name: "CN" });
    const t = await createTopic(userId, s.id, "OSI model");
    await setTopicCompleted(userId, t.id, true, today);
    const [rev] = await db.select().from(revisions).where(eq(revisions.topicId, t.id)).orderBy(revisions.step).limit(1);
    const params = { id: rev.id };

    const complete = (await import("@/app/api/v1/revisions/[id]/complete/route")).POST as Handler;
    const reopen = (await import("@/app/api/v1/revisions/[id]/reopen/route")).POST as Handler;
    const due = (await import("@/app/api/v1/revisions/[id]/due/route")).PUT as Handler;
    expect((await call(complete, "POST", "x", { token, params })).status).toBe(200);
    for (let i = 0; i < 2; i++) expect((await call(reopen, "POST", "x", { token, params })).json).toEqual({ reopened: true });
    const [after] = await db.select().from(revisions).where(eq(revisions.id, rev.id));
    expect(after.completedAt).toBeNull();

    for (let i = 0; i < 2; i++) expect((await call(due, "PUT", "x", { token, params, body: { dueDate: rev.dueDate } })).status).toBe(200);
    expect((await call(due, "PUT", "x", { token, params, body: { dueDate: "not-a-date" } })).status).toBe(400);

    const other = await signUp();
    expect((await call(reopen, "POST", "x", { token: other.token, params })).status).toBe(404);
  });

  it("fetches a single session, running or finished, and clears notes with an empty string", async () => {
    const { token } = await signUp();
    const started = await call(sessionsRoute.POST as Handler, "POST", "sessions", { token, body: {} });
    const params = { id: started.json.id };
    const running = await call(sessionRoute.GET as Handler, "GET", "x", { token, params });
    expect(running.status).toBe(200);
    expect(typeof running.json.elapsedSeconds).toBe("number");
    await call(sessionFinishRoute.POST as Handler, "POST", "x", { token, params });
    await call(sessionRoute.PATCH as Handler, "PATCH", "x", { token, params, body: { notes: "revisit deadlocks" } });
    expect((await call(sessionRoute.GET as Handler, "GET", "x", { token, params })).json.notes).toBe("revisit deadlocks");
    await call(sessionRoute.PATCH as Handler, "PATCH", "x", { token, params, body: { notes: "" } });
    const cleared = await call(sessionRoute.GET as Handler, "GET", "x", { token, params });
    expect(cleared.json.notes).toBeNull();
    expect(cleared.json.endedAt).not.toBeNull();
  });
});
