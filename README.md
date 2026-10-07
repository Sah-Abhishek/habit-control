# Almanac

A calm personal progress tracker: long-term goals, study sessions and topics, habits (including ones you want to do *less* of), daily check-ins, and insights that describe patterns in your own data — without streak pressure or gamification.

Designs live on the **Tracking** page of the Figma file; this app implements the desktop experience and stays usable on tablet and phone widths.

## Stack

- **Next.js 16** (App Router, server components, server actions) · React 19 · TypeScript (strict)
- **PostgreSQL** with **Drizzle ORM** and versioned SQL migrations (`./drizzle`)
- **Better Auth** — email + password, database sessions, rate-limited sign-in
- **Zod** validation · **Tailwind CSS v4** with design tokens mirroring Figma (light/dark)
- **Vitest** — unit tests for pure domain logic, integration tests against a real Postgres

## Getting started

Requirements: Node 22+, pnpm 9+, PostgreSQL 14+ binaries (the dev script uses `initdb`/`pg_ctl`; no sudo needed).

```bash
pnpm install
pnpm db:start                 # local Postgres cluster in ./.devdb on port 54329 (+ almanac_test DB)
cp .env.example .env.local    # then set BETTER_AUTH_SECRET: openssl rand -base64 32
pnpm db:migrate
pnpm db:seed                  # optional demo account (see below)
pnpm dev                      # http://localhost:3000
```

Already have Postgres? Skip `db:start` and point `DATABASE_URL` at your database.

### Demo account

`pnpm db:seed` creates **demo@almanac.local / demo-password-123** with ~90 days of history (a GATE CSE prep goal, six subjects, sessions, revisions, habits including a "Late-night scrolling" reduce habit, sleep/mood/energy). It writes directly to the database (hashing the password with Better Auth's own hasher), so the dev server doesn't need to be running. Re-running wipes and rebuilds only the demo user. It refuses to run with `NODE_ENV=production`.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js dev server / production build / production server |
| `pnpm typecheck` | Generates route types and runs `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit + integration tests (integration needs the dev DB running: `pnpm db:start`) |
| `pnpm db:start` / `db:stop` | Start/stop the local dev Postgres cluster |
| `pnpm db:generate` | Create a new migration from `src/server/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations (idempotent) |
| `pnpm db:seed` | Create/refresh the demo account |

Integration tests use `TEST_DATABASE_URL` (default `postgres://postgres@localhost:54329/almanac_test`) and migrate it automatically.

## Architecture

```
UI (server components + small client components)
  → server actions   src/server/actions/*   auth check · zod validation · ActionResult
  → services         src/server/services/*  all queries scoped by userId · business rules
  → database         src/server/db/*        Drizzle schema, constraints, migrations
domain               src/domain/*           pure functions (dates, habit stats, insights) — unit tested
```

- **Authorization**: every page and action calls `requireUser()`; services take the `userId` from the session, never from client input. Child records are verified to belong to the same user.
- **Days are local**: every log stores a `local_date` computed in the user's timezone (Settings), so a 23:30 entry never lands on the wrong day.
- **Integrity in the database**: check constraints on ranges, one log row per habit per day (atomic upserts — double taps and multiple tabs are safe), at most one running study session per user, `ON DELETE CASCADE` from the user so account deletion removes everything.
- **Errors**: actions return `{ ok, data } | { ok: false, error, fieldErrors }`; unexpected errors are logged server-side with context and shown to users as plain, non-technical messages.
- **States**: each section has loading skeletons, empty states that explain the next step, scoped error boundaries, and toasts with Undo instead of confirmation dialogs for reversible actions.

## Privacy & security

- Passwords are hashed (scrypt) by Better Auth; sessions are database-backed, `httpOnly`, `Secure` in production; sign-in/sign-up are rate-limited (DB-backed counters, effective in production).
- Security headers (`X-Frame-Options`, `nosniff`, referrer and permissions policies) on every response; exports are `Cache-Control: no-store`.
- Data is never sold or shared; there are no third-party trackers.
- Habits can be marked **sensitive**: excluded from exports unless the user opts in.
- **Export** (Settings → Export): all data as JSON, or one CSV per table (CSV cells are protected against spreadsheet formula injection). Password hashes and session tokens are never exported.
- **Delete account** (Settings → Delete account): requires typing the email and the current password; deletes the user and cascades to all data immediately.

## Known limitations

- No reminders or push notifications yet (the quiet-mode setting is stored for when they arrive).
- No offline write queue: Next's `useOffline` detects lost connectivity and retries navigations/server actions while the tab stays open, but changes aren't persisted locally.
- No AI-generated insights; observations are deterministic statistics with sample-size gating.
- No PDF export; weekly/monthly review screens are not built yet.
- The goal hierarchy models Goal → Subject → Topic → Task/Session; the "Project" level from the spec isn't modelled.
- Email verification and password reset by email are not set up (no mail provider configured).

## Deployment

1. Provision PostgreSQL and set environment variables:
   - `DATABASE_URL` — connection string (use TLS, e.g. `?sslmode=require`, for managed databases)
   - `BETTER_AUTH_SECRET` — 32+ random bytes (`openssl rand -base64 32`); rotating it signs everyone out
   - `BETTER_AUTH_URL` — the public origin, e.g. `https://almanac.example.com` (used for cookies and CSRF origin checks). Optional on Vercel: detected from `VERCEL_PROJECT_PRODUCTION_URL` (production) or `VERCEL_URL` (previews); set it explicitly when you add a custom domain.
2. Run `pnpm db:migrate` **before** starting the new version (migrations are additive and tracked in `__drizzle_migrations`).
3. `pnpm build && pnpm start` (or deploy to any Node host). The app validates env vars at startup and fails fast with the names of missing ones.
4. Serve over HTTPS only.
