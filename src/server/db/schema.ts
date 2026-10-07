import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Auth tables (shape required by Better Auth)                         */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Shared auth rate-limit counters, so limits hold across multiple server instances. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ------------------------------------------------------------------ */
/* App tables. Every row is owned by a user and cascades on delete,    */
/* so "delete my account" removes all personal data.                   */
/* Calendar days are stored as DATE in the user's own timezone         */
/* ("local_date") so a 23:30 log never lands on the wrong day.         */
/* ------------------------------------------------------------------ */

const ownerId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const themeEnum = pgEnum("theme", ["system", "light", "dark"]);

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("UTC"),
  theme: themeEnum("theme").notNull().default("system"),
  /** 0 = Sunday … 6 = Saturday */
  weekStartsOn: smallint("week_starts_on").notNull().default(1),
  dailyStudyTargetMin: integer("daily_study_target_min").notNull().default(120),
  /** Days after completion at which revisions are scheduled. */
  revisionScheduleDays: integer("revision_schedule_days").array().notNull().default(sql`'{1,3,7,21,45}'`),
  quietMode: boolean("quiet_mode").notNull().default(false),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const goalStatusEnum = pgEnum("goal_status", ["active", "paused", "completed", "archived"]);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    title: text("title").notNull(),
    description: text("description"),
    status: goalStatusEnum("status").notNull().default("active"),
    startDate: date("start_date").notNull(),
    targetDate: date("target_date"),
    /** Exactly one active goal can be the "main" goal shown on Today. */
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("goals_user_idx").on(t.userId),
    uniqueIndex("goals_one_primary_per_user").on(t.userId).where(sql`${t.isPrimary}`),
    check("goals_dates_ordered", sql`${t.targetDate} IS NULL OR ${t.targetDate} >= ${t.startDate}`),
  ],
);

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    targetDate: date("target_date"),
    progress: smallint("progress").notNull().default(0),
    position: integer("position").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("milestones_goal_idx").on(t.goalId),
    check("milestones_progress_range", sql`${t.progress} BETWEEN 0 AND 100`),
  ],
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    /** Share of exam marks / importance, 0–100. Optional; powers "effort vs weight". */
    weight: smallint("weight"),
    position: integer("position").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("subjects_user_idx").on(t.userId),
    check("subjects_weight_range", sql`${t.weight} IS NULL OR ${t.weight} BETWEEN 0 AND 100`),
  ],
);

export const topicStatusEnum = pgEnum("topic_status", ["not_started", "in_progress", "completed"]);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    progress: smallint("progress").notNull().default(0),
    status: topicStatusEnum("status").notNull().default("not_started"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("topics_subject_idx").on(t.subjectId),
    index("topics_user_idx").on(t.userId),
    check("topics_progress_range", sql`${t.progress} BETWEEN 0 AND 100`),
  ],
);

export const revisions = pgTable(
  "revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    /** 1-based step in the schedule (Rev 1, Rev 2, …). */
    step: smallint("step").notNull(),
    dueDate: date("due_date").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("revisions_user_due_idx").on(t.userId, t.dueDate),
    uniqueIndex("revisions_topic_step_unique").on(t.topicId, t.step),
  ],
);

export const studyMethodEnum = pgEnum("study_method", [
  "lecture",
  "reading",
  "notes",
  "practice",
  "problem_solving",
  "revision",
  "mock_test",
  "project_work",
]);

export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
    method: studyMethodEnum("method"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    /** NULL while the session is running. */
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /** Set while paused; paused time is excluded from the duration. */
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedSeconds: integer("paused_seconds").notNull().default(0),
    /** Day the session counts towards, in the user's timezone at start. */
    localDate: date("local_date").notNull(),
    durationSeconds: integer("duration_seconds"),
    /** 1 = poor … 5 = excellent */
    focus: smallint("focus"),
    questionsAttempted: integer("questions_attempted"),
    questionsCorrect: integer("questions_correct"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("study_sessions_user_date_idx").on(t.userId, t.localDate),
    // At most one running session per user — protects against double clicks and multiple tabs.
    uniqueIndex("study_sessions_one_running").on(t.userId).where(sql`${t.endedAt} IS NULL`),
    check("study_sessions_focus_range", sql`${t.focus} IS NULL OR ${t.focus} BETWEEN 1 AND 5`),
    check(
      "study_sessions_questions_valid",
      sql`${t.questionsCorrect} IS NULL OR ${t.questionsAttempted} IS NULL OR ${t.questionsCorrect} <= ${t.questionsAttempted}`,
    ),
    check("study_sessions_end_after_start", sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`),
  ],
);

export const priorityEnum = pgEnum("task_priority", ["low", "medium", "high", "critical"]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    title: text("title").notNull(),
    notes: text("notes"),
    dueDate: date("due_date"),
    priority: priorityEnum("priority").notNull().default("medium"),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
    estimateMinutes: integer("estimate_minutes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tasks_user_due_idx").on(t.userId, t.dueDate)],
);

export const habitKindEnum = pgEnum("habit_kind", ["build", "reduce"]);
export const habitTrackingEnum = pgEnum("habit_tracking", ["binary", "quantity", "duration", "numeric"]);

export const habits = pgTable(
  "habits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text("name").notNull(),
    kind: habitKindEnum("kind").notNull().default("build"),
    tracking: habitTrackingEnum("tracking").notNull().default("binary"),
    /**
     * build: amount that counts as "done" for the day (1 for binary).
     * reduce: daily limit (0 = stop completely).
     */
    target: numeric("target", { precision: 10, scale: 2, mode: "number" }).notNull().default(1),
    unit: text("unit"),
    /** Days of week the habit is scheduled (0 = Sunday). */
    scheduleDays: smallint("schedule_days").array().notNull().default(sql`'{0,1,2,3,4,5,6}'`),
    /** reduce only: typical daily amount before starting. */
    baseline: numeric("baseline", { precision: 10, scale: 2, mode: "number" }),
    /** Hidden from glanceable surfaces and excluded from exports by default. */
    isSensitive: boolean("is_sensitive").notNull().default(false),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    startedOn: date("started_on").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("habits_user_idx").on(t.userId),
    check("habits_target_nonnegative", sql`${t.target} >= 0`),
  ],
);

export const habitLogs = pgTable(
  "habit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    localDate: date("local_date").notNull(),
    value: numeric("value", { precision: 10, scale: 2, mode: "number" }).notNull(),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One row per habit per day: logging is an idempotent upsert.
    uniqueIndex("habit_logs_habit_day_unique").on(t.habitId, t.localDate),
    index("habit_logs_user_date_idx").on(t.userId, t.localDate),
    check("habit_logs_value_nonnegative", sql`${t.value} >= 0`),
  ],
);

/** One journal row per user per day: check-in values, sleep, focus, note. */
export const days = pgTable(
  "days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    localDate: date("local_date").notNull(),
    mood: smallint("mood"),
    energy: smallint("energy"),
    stress: smallint("stress"),
    sleepStart: timestamp("sleep_start", { withTimezone: true }),
    sleepEnd: timestamp("sleep_end", { withTimezone: true }),
    sleepQuality: smallint("sleep_quality"),
    focusTopicId: uuid("focus_topic_id").references(() => topics.id, { onDelete: "set null" }),
    focusText: text("focus_text"),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("days_user_date_unique").on(t.userId, t.localDate),
    check("days_mood_range", sql`${t.mood} IS NULL OR ${t.mood} BETWEEN 1 AND 10`),
    check("days_energy_range", sql`${t.energy} IS NULL OR ${t.energy} BETWEEN 1 AND 10`),
    check("days_stress_range", sql`${t.stress} IS NULL OR ${t.stress} BETWEEN 1 AND 10`),
    check("days_sleep_quality_range", sql`${t.sleepQuality} IS NULL OR ${t.sleepQuality} BETWEEN 1 AND 10`),
    check("days_sleep_ordered", sql`${t.sleepStart} IS NULL OR ${t.sleepEnd} IS NULL OR ${t.sleepEnd} > ${t.sleepStart}`),
  ],
);
