/**
 * Demo data: `pnpm db:seed`
 *
 * Creates (or recreates) demo@almanac.local / demo-password-123 with ~90 days of
 * realistic history that tells the same story as the Figma designs.
 *
 * The user is written straight to the database, with the password hashed by
 * better-auth's own hasher and stored the way better-auth's email sign-up does
 * (account.provider_id = "credential"). That avoids needing a running server and
 * keeps the script independent of Next.js ("server-only" modules can't load here).
 *
 * Idempotent: deleting the demo user cascades to all of its data, then it is rebuilt.
 * Other users are never touched. Refuses to run in production.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { addLocalDays, dayOfWeek, localDateIn, startOfLocalDay, type LocalDate } from "../src/domain/dates";
import * as schema from "../src/server/db/schema";

config({ path: process.env.DOTENV_PATH ?? ".env.local" });

const EMAIL = "demo@almanac.local";
const PASSWORD = "demo-password-123";
const TZ = "Asia/Kolkata";
const DAYS = 90;

/** Small deterministic PRNG so every seed produces the same story. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(214);
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const chance = (p: number) => rand() < p;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
function pickWeighted<T>(items: Array<[T, number]>): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [item, w] of items) if ((r -= w) <= 0) return item;
  return items[items.length - 1][0];
}
const at = (date: LocalDate, hours: number) => new Date(startOfLocalDay(date, TZ).getTime() + hours * 3_600_000);

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 2 });
  const db = drizzle(pool, { schema, casing: "snake_case" });

  try {
    await db.transaction(async (tx) => {
      await tx.delete(schema.user).where(eq(schema.user.email, EMAIL));

      const userId = randomUUID();
      const today = localDateIn(TZ);
      const start = addLocalDays(today, -(DAYS - 1));
      // Backdate the account to the start of the demo history, otherwise earlier days read as "before you joined".
      const joinedAt = new Date(Date.now() - (DAYS + 1) * 24 * 60 * 60 * 1000);
      await tx.insert(schema.user).values({ id: userId, name: "Demo", email: EMAIL, emailVerified: true, createdAt: joinedAt, updatedAt: joinedAt });
      await tx.insert(schema.account).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: await hashPassword(PASSWORD) });
      await tx.insert(schema.userSettings).values({ userId, timezone: TZ, dailyStudyTargetMin: 130, onboardedAt: new Date() });

      // Goal + milestones
      const [goal] = await tx
        .insert(schema.goals)
        .values({ userId, title: "Crack GATE CSE", description: "Score 700+ and get into an IIT M.Tech.", startDate: addLocalDays(today, -214), targetDate: addLocalDays(today, 142), isPrimary: true })
        .returning();
      const ms: Array<[string, number, number]> = [
        ["Complete syllabus", 65, 54],
        ["First revision", 30, 74],
        ["PYQs (10 years)", 20, 100],
        ["Mock tests", 5, 126],
        ["Final revision", 0, 140],
      ];
      await tx.insert(schema.milestones).values(ms.map(([title, progress, inDays], i) => ({ userId, goalId: goal.id, title, progress, targetDate: addLocalDays(today, inDays), position: i })));

      // Subjects (weight = share of marks) and topics [name, progress]
      const plan: Array<[string, number, number, Array<[string, number]>]> = [
        ["DBMS", 8, 5, [["SQL", 85], ["ER Model", 70], ["Relational Algebra", 60], ["Normalization", 100], ["Transactions", 35], ["Indexing", 0]]],
        ["Algorithms", 9, 3, [["Sorting", 100], ["Greedy", 80], ["Dynamic Programming", 55], ["Graphs", 60], ["Complexity", 40]]],
        ["Computer Networks", 9, 2.5, [["OSI & TCP/IP", 100], ["IP Addressing", 75], ["Routing", 50], ["Transport Layer", 40], ["Application Layer", 20]]],
        ["Theory of Computation", 8, 1.6, [["Regular Languages", 100], ["Context-free", 60], ["Turing Machines", 30], ["Decidability", 10]]],
        ["Computer Organization", 9, 1.2, [["Number Systems", 100], ["Pipelining", 45], ["Cache", 30], ["I/O", 0]]],
        ["Operating Systems", 10, 0.5, [["Processes", 70], ["Scheduling", 55], ["Paging & TLB", 100], ["Deadlocks", 20], ["File Systems", 0]]],
      ];
      const subjectRows: Array<{ id: string; weight: number; topicIds: string[]; topics: Array<{ id: string; name: string; progress: number }> }> = [];
      for (const [i, [name, weight, , topics]] of plan.entries()) {
        const [s] = await tx.insert(schema.subjects).values({ userId, goalId: goal.id, name, weight, position: i }).returning();
        const rows = await tx
          .insert(schema.topics)
          .values(
            topics.map(([tname, progress], j) => ({
              userId,
              subjectId: s.id,
              name: tname,
              progress,
              position: j,
              status: progress >= 100 ? ("completed" as const) : progress > 0 ? ("in_progress" as const) : ("not_started" as const),
              completedAt: progress >= 100 ? at(addLocalDays(today, -int(3, 40)), 20) : null,
            })),
          )
          .returning();
        subjectRows.push({ id: s.id, weight: plan[i][2], topicIds: rows.map((r) => r.id), topics: rows.map((r) => ({ id: r.id, name: r.name, progress: r.progress })) });
      }

      // Revisions for completed topics, following the default schedule.
      const schedule = [1, 3, 7, 21, 45];
      const allTopics = (await tx.select().from(schema.topics).where(eq(schema.topics.userId, userId))).filter((t) => t.completedAt);
      const revisionRows: Array<typeof schema.revisions.$inferInsert> = [];
      for (const t of allTopics) {
        const done = localDateIn(TZ, t.completedAt!);
        schedule.forEach((d, i) => {
          const due = addLocalDays(done, d);
          const past = due < today;
          revisionRows.push({ userId, topicId: t.id, step: i + 1, dueDate: due, completedAt: past && chance(0.82) ? at(due, 19) : null });
        });
      }
      // Make the dashboard story concrete: Normalization Rev 2 due today.
      const normalization = allTopics.find((t) => t.name === "Normalization");
      if (normalization) {
        const done = addLocalDays(today, -3);
        await tx.update(schema.topics).set({ completedAt: at(done, 20) }).where(eq(schema.topics.id, normalization.id));
        for (const r of revisionRows.filter((r) => r.topicId === normalization.id)) {
          r.dueDate = addLocalDays(done, schedule[(r.step as number) - 1]);
          r.completedAt = r.step === 1 ? at(addLocalDays(done, 1), 19) : null;
        }
      }
      await tx.insert(schema.revisions).values(revisionRows);

      // Days: sleep, mood, energy (most days, not all — real logging is patchy).
      const sleepByDay = new Map<LocalDate, number>();
      const energyByDay = new Map<LocalDate, number>();
      const dayRows: Array<typeof schema.days.$inferInsert> = [];
      for (let i = 0; i < DAYS; i++) {
        const date = addLocalDays(start, i);
        const progress = i / DAYS;
        const bed = between(23.0, 25.6) - progress * 0.5; // hours after previous midnight
        const sleepH = clamp(between(5.6, 8.2) + progress * 0.3, 4.5, 9);
        sleepByDay.set(date, sleepH);
        const logged = chance(0.85);
        const energy = clamp(Math.round(3 + (sleepH - 5) * 1.3 + between(-1.2, 1.2)), 1, 10);
        energyByDay.set(date, energy);
        dayRows.push({
          userId,
          localDate: date,
          sleepStart: logged ? at(addLocalDays(date, -1), bed) : null,
          sleepEnd: logged ? at(addLocalDays(date, -1), bed + sleepH) : null,
          sleepQuality: logged ? clamp(Math.round(sleepH - 0.5 + between(-1, 1.5)), 1, 10) : null,
          mood: chance(0.8) ? clamp(Math.round(6 + (sleepH - 6.5) + between(-1.5, 2)), 1, 10) : null,
          energy: chance(0.8) ? energy : null,
          note: chance(0.08) ? pickWeighted([["Mock went well — revise deadlocks before Friday.", 1], ["Late workday, studied less.", 1], ["Good morning session.", 1]]) : null,
        });
      }
      const todayRow = dayRows.find((d) => d.localDate === today);
      const transactions = subjectRows[0].topics.find((t) => t.name === "Transactions");
      if (todayRow) Object.assign(todayRow, { mood: null, energy: 7, focusTopicId: transactions?.id ?? null, focusText: "Serializability + 2 PYQ sets" });
      await tx.insert(schema.days).values(dayRows);

      // Study sessions: mornings focus better, short sleep hurts focus; OS is neglected.
      const methods = ["lecture", "reading", "practice", "problem_solving", "revision", "notes"] as const;
      const studyMinutes = new Map<LocalDate, number>();
      const sessionRows: Array<typeof schema.studySessions.$inferInsert> = [];
      for (let i = 0; i < DAYS; i++) {
        const date = addLocalDays(start, i);
        const isToday = date === today;
        const weekend = [0, 6].includes(dayOfWeek(date));
        const sleepH = sleepByDay.get(date) ?? 7;
        if (!isToday && !chance(weekend ? 0.92 : 0.82)) continue;
        const count = isToday ? 2 : int(1, weekend ? 3 : 2);
        const slots = isToday ? [7.75, 10] : [between(7, 9.5), between(10, 13), between(18, 21.5)].sort(() => rand() - 0.5).slice(0, count).sort((a, b) => a - b);
        for (const [k, startH] of slots.entries()) {
          const subject = isToday ? subjectRows[0] : pickWeighted(subjectRows.map((s) => [s, s.weight] as [typeof s, number]));
          const tired = (energyByDay.get(date) ?? 6) < 5;
          const minutes = isToday ? (k === 0 ? 90 : 45) : Math.round(between(30, 95) * (tired ? 0.65 : 1));
          const morning = startH < 12;
          const focus = clamp(Math.round(2.6 + (morning ? 1 : 0) + (sleepH >= 7 ? 0.8 : -0.3) + between(-0.9, 0.9)), 1, 5);
          const method = pickWeighted(methods.map((m) => [m, m === "practice" || m === "problem_solving" ? 3 : 1] as [(typeof methods)[number], number]));
          const solving = method === "practice" || method === "problem_solving";
          const attempted = solving ? int(8, 30) : null;
          const startedAt = at(date, startH);
          sessionRows.push({
            userId,
            subjectId: subject.id,
            topicId: subject.topicIds[int(0, subject.topicIds.length - 1)],
            method,
            startedAt,
            endedAt: new Date(startedAt.getTime() + minutes * 60_000),
            localDate: date,
            durationSeconds: minutes * 60,
            focus,
            questionsAttempted: attempted,
            questionsCorrect: attempted != null ? Math.round(attempted * clamp(0.62 + i / DAYS / 5 + focus * 0.02 + between(-0.08, 0.08), 0.3, 1)) : null,
          });
          studyMinutes.set(date, (studyMinutes.get(date) ?? 0) + minutes);
        }
      }
      await tx.insert(schema.studySessions).values(sessionRows);

      // Habits
      const habitStart = start;
      const everyDay = [0, 1, 2, 3, 4, 5, 6];
      const [studyBlock, exercise, meditation, eating, sleepBy12, scrolling] = await tx
        .insert(schema.habits)
        .values([
          { userId, name: "Study block", startedOn: habitStart, position: 0, goalId: goal.id, scheduleDays: everyDay },
          { userId, name: "Exercise", startedOn: habitStart, position: 1, scheduleDays: everyDay },
          { userId, name: "Meditation", tracking: "duration" as const, target: 10, unit: "min", startedOn: habitStart, position: 2, scheduleDays: everyDay },
          { userId, name: "Healthy eating", tracking: "quantity" as const, target: 4, unit: "meals", startedOn: habitStart, position: 3, scheduleDays: everyDay },
          { userId, name: "Sleep before 12", startedOn: habitStart, position: 4, goalId: goal.id, scheduleDays: everyDay },
          { userId, name: "Late-night scrolling", kind: "reduce" as const, tracking: "quantity" as const, target: 3, baseline: 4.1, unit: "times", isSensitive: true, startedOn: habitStart, position: 5, scheduleDays: everyDay },
        ])
        .returning();
      const logs: Array<typeof schema.habitLogs.$inferInsert> = [];
      const log = (habitId: string, date: LocalDate, value: number) => {
        if (value > 0) logs.push({ userId, habitId, localDate: date, value });
      };
      for (let i = 0; i < DAYS; i++) {
        const date = addLocalDays(start, i);
        const p = i / DAYS;
        const isToday = date === today;
        const studied = studyMinutes.get(date) ?? 0;
        if (studied >= 30) log(studyBlock.id, date, 1);
        if (isToday || chance(0.65 + p * 0.25)) log(exercise.id, date, 1);
        if (!isToday && chance(0.62 - p * 0.15)) log(meditation.id, date, int(8, 20));
        log(eating.id, date, isToday ? 4 : int(2, 5));
        if (!isToday && chance(0.45 + p * 0.35)) log(sleepBy12.id, date, 1);
        // Trending down from the 4.1 baseline; worse on low-study days.
        const expected = 4.3 - p * 2.3 + (studied < 60 ? 1.2 : 0);
        log(scrolling.id, date, isToday ? 2 : Math.max(0, Math.round(expected + between(-1.5, 1.2))));
      }
      await tx.insert(schema.habitLogs).values(logs);

      // Tasks
      const dbms = subjectRows[0];
      const taskDefs: Array<Omit<typeof schema.tasks.$inferInsert, "userId">> = [
        { title: "Solve PYQ set 3 — serializability", priority: "critical", dueDate: today, estimateMinutes: 40, topicId: transactions?.id, subjectId: dbms.id, goalId: goal.id },
        { title: "Revise normalization (Rev 2)", priority: "high", dueDate: today, estimateMinutes: 12, topicId: normalization?.id, subjectId: dbms.id, goalId: goal.id },
        { title: "Read conflict serializability notes", priority: "medium", dueDate: today, estimateMinutes: 30, subjectId: dbms.id, completedAt: at(today, 8.5) },
        { title: "Book mock test slot for Sunday", priority: "low", dueDate: today, estimateMinutes: 5, goalId: goal.id, completedAt: at(today, 9) },
        { title: "OS: deadlock PYQs", priority: "high", dueDate: addLocalDays(today, 2), estimateMinutes: 45, subjectId: subjectRows[5].id, goalId: goal.id },
        { title: "Make TOC formula sheet", priority: "medium", dueDate: addLocalDays(today, 4), estimateMinutes: 60, subjectId: subjectRows[3].id },
        { title: "Full-length mock #3", priority: "critical", dueDate: addLocalDays(today, 4), estimateMinutes: 180, goalId: goal.id },
        { title: "Update study plan for November", priority: "low", dueDate: null, estimateMinutes: 20, goalId: goal.id },
        { title: "Graphs: Dijkstra practice", priority: "medium", dueDate: addLocalDays(today, -2), estimateMinutes: 50, subjectId: subjectRows[1].id, completedAt: at(addLocalDays(today, -2), 21) },
      ];
      await tx.insert(schema.tasks).values(taskDefs.map((t) => ({ ...t, userId })));

      console.log(`Seeded ${EMAIL} (password: ${PASSWORD}) — ${sessionRows.length} sessions, ${logs.length} habit logs, ${dayRows.length} days, ${revisionRows.length} revisions.`);
    });
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
