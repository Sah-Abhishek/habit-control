# Almanac REST API v1 (native clients)

Base path: `/api/v1`. JSON in and out (`Content-Type: application/json`).

## Conventions

- **Auth**: `Authorization: Bearer <token>`. Cookies are ignored on `/api/v1`.
  - Sign up: `POST /api/auth/sign-up/email` `{ name, email, password }` → token in the `set-auth-token` response header.
  - Sign in: `POST /api/auth/sign-in/email` `{ email, password }` → token in `set-auth-token`. Wrong credentials → 401. Too many attempts → 429.
  - Sign out: `POST /api/auth/sign-out` with the bearer header and body `{}`.
  - Tokens are opaque strings; store them encrypted. Any 401 on `/api/v1` means: drop the token, go to sign-in.
- **Dates**: `LocalDate` = `"YYYY-MM-DD"` in the user's timezone. Instants = ISO-8601 UTC strings. Times of day = `"HH:mm"` (24h, user's timezone).
- **Errors**: non-2xx bodies are always
  `{ "error": { "code": "unauthorized|validation|not_found|conflict|unprocessable|internal", "message": "human readable", "fieldErrors"?: { "field": "message" } } }`
  - 400 validation (show `fieldErrors` next to fields), 401 unauthorized, 404 not_found, 409 conflict, 422 unprocessable (business rule; show `message`), 500 internal (show `message`, it contains a reference id).
- `message` strings are written for end users and can be shown as-is.
- Deletes return `204` with no body.
- Ids are UUIDs except `user.id`.

## Shared shapes

```ts
type DayState = "done" | "partial" | "missed" | "clear" | "within" | "over" | "pending" | "off" | "future";
type Tick = { date: LocalDate; state: DayState; value: number };
type Consistency = { successes: number; scheduled: number; rate: number | null }; // rate 0..1
type Priority = "low" | "medium" | "high" | "critical";
type StudyMethod = "lecture" | "reading" | "notes" | "practice" | "problem_solving" | "revision" | "mock_test" | "project_work";
type GoalStatus = "active" | "paused" | "completed" | "archived";
```

## Me & settings

`GET /me` →
```json
{ "user": { "id": "…", "email": "…", "name": "…" }, "today": "2026-10-07",
  "settings": { "timezone": "Asia/Kolkata", "theme": "system|light|dark", "weekStartsOn": 1,
    "dailyStudyTargetMin": 130, "revisionScheduleDays": [1,3,7,21,45], "quietMode": false, "onboarded": true } }
```
`PATCH /settings` body (400 with `fieldErrors` on invalid values, e.g. unknown timezone): any subset of `{ timezone, theme, weekStartsOn, dailyStudyTargetMin, revisionScheduleDays, quietMode, onboarded: true }` → same `settings` object as `/me`.
`DELETE /account` body `{ email, password }` → 204 (wrong email/password → 422 with a message) (permanently deletes the user and all data; client then clears its token and local cache).

## Today

`GET /today` →
```json
{
  "today": "2026-10-07",
  "greeting": "morning|afternoon|evening",
  "goalDay": { "day": 215, "total": 357 } | null,
  "focus": { "topicId": "uuid|null", "text": "string|null", "label": "DBMS — Transactions" | null, "feeds": "Crack GATE CSE · Complete syllabus (65%)" | null },
  "study": { "todaySeconds": 8100, "targetSeconds": 7800 },
  "timeline": [ { "startHour": 0.66, "endHour": 7.33, "kind": "sleep|study|running" } ],
  "nowHour": 11.33,
  "habits": [HabitSummary],               // scheduled today only, same shape as GET /habits items
  "tasks": [TaskRow],                     // open due ≤ today (+overdue) and completed today
  "revisionsDue": [DueRevision],
  "goal": PrimaryGoalSummary | null,
  "week": [ { "date": LocalDate, "seconds": 8640, "future": false } ],   // 7 days from week start
  "checkIn": { "mood": 7|null, "energy": 7|null, "stress": null, "note": null,
               "sleep": { "bed": "00:40", "wake": "07:20", "quality": 7, "hours": 6.67 } | null },
  "runningSession": RunningSession | null,
  "observation": { "text": "…", "n": 51, "earlySignal": false } | null
}
```

## Habits

`HabitSummary` =
```ts
{ id, name, kind: "build"|"reduce", tracking: "binary"|"quantity"|"duration"|"numeric", target: number, unit: string|null,
  scheduleDays: number[] /*0=Sun*/, baseline: number|null, isSensitive: boolean, goalId: string|null, startedOn: LocalDate, archived: boolean,
  today: { value: number, state: DayState, scheduled: boolean },
  consistency: { d7: Consistency, d30: Consistency, d90: Consistency },
  streak: { current: number, best: number },
  trail7: Tick[],
  reduction: null | { weekAvg, prevWeekAvg, monthAvg, prevMonthAvg, weekChange /*+ = improvement*/, daysSinceLast, longestClearRun, clearDaysLast30, avoidedVsBaseline, todayValue } }
```
- `GET /habits` → `{ today, habits: HabitSummary[], archived: [{ id, name, kind }] }`
- `POST /habits` body `HabitInput` = `{ name, kind, tracking, target, unit?, scheduleDays, baseline?, isSensitive, goalId? }` → 201 habit (summary fields without `today/consistency/streak/trail7/reduction`)
- `GET /habits/{id}` → `{ habit: HabitSummary, thread90: Tick[], weeklyAverages: [{ weekEnd, avg|null }] /*reduce only, 12*/, recentDays: Tick[] /*newest first, ≤14*/ }`
- `PATCH /habits/{id}` body `HabitInput` (full) → habit
- `DELETE /habits/{id}` → 204
- `PUT /habits/{id}/archived` `{ archived: boolean }` → `{ archived }`
- `PUT /habits/{id}/logs/{date}` `{ value }` → `{ value, previous }` — **idempotent set**, 0 clears. Use for offline replay.
- `POST /habits/{id}/logs/{date}/increment` `{ delta }` → `{ value, previous }` — atomic, not idempotent.
- Rules: future dates → 422; archived habit → 422; more than 365 days back → 422.

## Tasks

`TaskRow` = `{ id, title, notes, dueDate|null, priority, estimateMinutes|null, completedAt|null (instant), goalId, goalTitle, subjectId, subjectName, topicId, topicName, overdue: boolean }`
- `GET /tasks?filter=today|upcoming|someday|completed` (default `today`) → `{ tasks: TaskRow[] }`
- `GET /tasks/options` → `{ goals: [{id,title}], subjects: [{id,name}], topics: [{id,name,subjectId}] }`
- `POST /tasks` body `TaskInput` = `{ title, notes?, dueDate?, priority, goalId?, subjectId?, topicId?, estimateMinutes? }` → 201 TaskRow
- `PATCH /tasks/{id}` body `TaskInput` (full) → TaskRow
- `PUT /tasks/{id}/done` `{ done: boolean }` → `{ done }` (idempotent)
- `DELETE /tasks/{id}` → 204

## Goals

`GoalCard` = `{ id, title, description, status, startDate, targetDate|null, isPrimary, progress /*0..1*/, expected /*0..1|null*/, pace: "ahead"|"on_pace"|"behind"|null, daysLeft|null, estFinish|null, milestoneCount, completedMilestones }`
`PrimaryGoalSummary` = `{ id, title, progress, targetDate, daysLeft, expected, status /*pace*/, estFinish, milestones: [{ id, title, progress /*0..100*/, completed }] }`
- `GET /goals` → `{ goals: GoalCard[] }`
- `POST /goals` `{ title, description?, startDate, targetDate?, isPrimary? }` → 201 GoalCard
- `GET /goals/{id}` → `{ goal: GoalCard, velocityPerWeek: number|null /*fraction of the whole goal per week, 0..1 (e.g. 0.031 = 3.1%/wk)*/, neededPerWeek: number|null /*same unit*/, milestones: [{ id, title, targetDate, progress, position, completed }], subjects: [{ id, name, progress /*0..1*/ }], habits: [{ id, name, rate30: number|null }], tasks: TaskRow[] }`
- `PATCH /goals/{id}` (same body as POST) → GoalCard
- `PUT /goals/{id}/status` `{ status }` → `{ status }`
- `PUT /goals/{id}/primary` `{}` → `{ isPrimary: true }`
- `DELETE /goals/{id}` → 204
- `POST /goals/{id}/milestones` `{ title, targetDate?, progress }` → 201 milestone (`Milestone` = `{ id, title, targetDate, progress /*0..100*/, position, completed }`; PATCH and complete return the same shape)
- `PATCH /milestones/{id}` `{ title, targetDate?, progress }` → milestone
- `PUT /milestones/{id}/complete` `{ complete: boolean }` → milestone
- `DELETE /milestones/{id}` → 204

## Study

`SubjectSummary` = `{ id, name, goalId, goalTitle, weight|null, progress /*0..1*/, topicCount, completedTopics, studySeconds, archived }`
`Topic` = `{ id, subjectId, name, progress /*0..100*/, status: "not_started"|"in_progress"|"completed", position, revisions: [{ id, step, dueDate, completedAt|null, skippedAt|null }] }`
`DueRevision` = `{ id, step, dueDate, overdueDays, topicId, topicName, subjectId, subjectName }`
`Session` = `{ id, subjectId, subjectName, topicId, topicName, method|null, startedAt, endedAt|null, pausedAt|null, pausedSeconds, localDate, durationSeconds|null, focus /*1..5*/|null, questionsAttempted|null, questionsCorrect|null, notes|null }`
`RunningSession` = `Session` + `{ elapsedSeconds /*server-computed at response time, excludes pauses*/, serverNow /*instant*/ }`
- `GET /study` → `{ subjects: SubjectSummary[], revisionsDue: DueRevision[], recentSessions: Session[] /*≤10*/, running: RunningSession|null, todaySeconds, targetSeconds }`
- `POST /subjects` `{ name, goalId?, weight? }` → 201 SubjectSummary · `PATCH /subjects/{id}` same → SubjectSummary · `DELETE /subjects/{id}` → 204
- `GET /subjects/{id}` → `{ subject: SubjectSummary, topics: Topic[], recentSessions: Session[], accuracy: number|null }`
- `POST /subjects/{id}/topics` `{ name }` → 201 Topic · `PATCH /topics/{id}` `{ name?, progress? }` → Topic · `PUT /topics/{id}/completed` `{ completed }` → Topic (schedules / removes revisions) · `DELETE /topics/{id}` → 204
- `GET /topics/options` → `{ topics: [{ id, name, subjectId, subjectName }] }`
- `POST /revisions/{id}/complete` → `{ wasCompleted }` · `POST /revisions/{id}/snooze` → `{ previousDueDate }`
- Undo: `POST /revisions/{id}/reopen` → `{ reopened: true }` · `PUT /revisions/{id}/due` `{ dueDate }` → `{ dueDate }` (restore a snoozed date)
- Sessions:
  - `GET /sessions/running` → `RunningSession | null` (JSON `null`)
  - `GET /sessions/{id}` → `Session` (or `RunningSession` while running)
  - `POST /sessions` `{ subjectId?, topicId?, method? }` → 201 `RunningSession` (if one is already running: 200 with that session and header `X-Already-Running: 1`)
  - `POST /sessions/{id}/pause` · `/resume` → RunningSession
  - `POST /sessions/{id}/tally` `{ result: "correct"|"missed"|"undo-correct"|"undo-missed" }` → `{ attempted, correct }`
  - `POST /sessions/{id}/finish` → `{ session: Session, longSession: boolean /*> 3h → suggest editing times*/ }` (idempotent)
  - `PATCH /sessions/{id}` `{ focus?, method?, questionsAttempted?, questionsCorrect?, notes?, subjectId?, topicId?, topicProgress? }` → Session. Partial: omitted fields keep their current values; `null` clears one. `topicProgress` (0..100) updates the session's topic.
  - `PUT /sessions/{id}/times` `{ date, startTime: "HH:mm", endTime: "HH:mm" }` → Session (end before start = crosses midnight; ≤16h; not in future)
  - `POST /sessions/past` `{ subjectId?, topicId?, method?, date, startTime, endTime, focus?, questionsAttempted?, questionsCorrect?, notes? }` → 201 Session
  - `DELETE /sessions/{id}` → 204
  - `GET /sessions?from=YYYY-MM-DD&to=YYYY-MM-DD` (both default to today; ≤ 92 days, else 422) → `{ sessions: Session[] }` (finished only, newest first)

## Days (check-in, sleep, focus)

`DayEntry` = `{ date, mood|null, energy|null, stress|null, note|null, sleep: { bed, wake, quality|null, hours } | null, focus: { topicId|null, text|null, label|null } }`
- `GET /days/{date}` → DayEntry (empty values when nothing logged)
- `PATCH /days/{date}/check-in` `{ mood?, energy?, stress?, note? }` (1..10 or null to clear) → DayEntry — idempotent
- `PUT /days/{date}/sleep` `{ bed: "HH:mm", wake: "HH:mm", quality?: 1..10|null }` → DayEntry (sleep on date D = the night ending the morning of D) · `DELETE /days/{date}/sleep` → 204
- `PUT /days/{date}/focus` `{ topicId?: uuid|null, text?: string|null }` → DayEntry (omitted = null; both null clears the focus; a topic you don't own → 422)
- Future dates → 422. Past dates editable up to 365 days.

## Calendar

`GET /calendar?month=YYYY-MM` (default: current month; malformed → 400). `days` covers exactly the calendar month →
```json
{ "month": "2026-10", "weekStartsOn": 1, "today": "2026-10-07",
  "days": [ { "date": "2026-10-01", "score": 0.82|null, "studySeconds": 8100, "studyTargetHit": true, "habitsOnTrack": 4, "habitsScheduled": 6,
              "tasksCompleted": 3, "reduceOver": false, "future": false, "beforeAccount": false } ] }
```
`GET /calendar/day/{date}` → `{ date, score, studySeconds, sessions: Session[], habits: [{ id, name, state, value }], tasksCompleted: [{ id, title }], entry: DayEntry }`

## Insights & review

`GET /insights?range=7d|30d|90d|1y` → the same data the web Insights page renders:
```json
{ "range": "30d", "start": "…", "end": "…",
  "kpis": { "studySeconds", "prevStudySeconds"|null, "avgDailySeconds", "targetSeconds", "consistency": {"days","total"}, "avgFocus"|null, "focusSessions", "accuracy"|null, "attempted", "correct", "revisions": {"done","due"} },
  "weekly": [ { "weekStart", "seconds", "partial": bool } ], "weeklyTargetSeconds",
  "habitThreads": [ { "id", "name", "kind", "ticks": Tick[], "rate"|null, "trend": "up|down|flat|null" } ],
  "effort": [ { "subjectId", "name", "timeShare", "weightShare"|null, "underInvested": bool } ],
  "focusByHour": [ { "hour": 0..23, "avgFocus"|null, "sessions" } ],
  "wellbeing": [ { "date", "sleepHours"|null, "mood"|null, "energy"|null } ],
  "observations": [ { "text", "n", "earlySignal": bool } ] }
```
`GET /review/weekly?week=YYYY-MM-DD` (any date in the week; default = last completed week; a week starting after today → 422) → (`study.byDay` items are `{ date, seconds, future }`)
```json
{ "weekStart", "weekEnd", "weekNumber",
  "study": { "seconds", "targetSeconds", "prevSeconds", "changePct"|null, "byDay": [ { "date", "seconds" } ] },
  "consistency": { "daysStudied", "days": 7 },
  "habits": { "avgPerDay"|null, "scheduledPerDay"|null },
  "sleep": { "avgHours"|null, "changeMinutes"|null }, "mood": avg|null, "energy": avg|null,
  "subjects": [ { "id", "name", "seconds", "share" } ],
  "wentWell": [string], "needsAttention": [string], "suggestion": string|null }
```
All text is generated deterministically from the numbers (no AI) and phrased as observations.
