# Almanac for Android

Native Kotlin / Jetpack Compose client for the Almanac API (`../docs/api.md`).

## Run on a phone (USB)

1. Start the web app: in the repo root, `pnpm db:start && pnpm dev` (and `pnpm db:seed` for demo data).
2. Enable USB debugging on the phone, connect it, then:
   ```
   adb reverse tcp:3000 tcp:3000          # phone's localhost:3000 → this computer
   cd mobile && ./gradlew :app:installDebug
   ```
3. Sign in with `demo@almanac.local` / `demo-password-123` (or create an account).

The API base URL comes from `mobile/local.properties` (`almanac.apiBaseUrl=…/api/v1/`, default `http://localhost:3000/api/v1/`). Plain HTTP is only allowed to `localhost`; everything else must be HTTPS.

## Architecture

- `core/network` — OkHttp client, bearer auth, API error envelope → `AppError`.
- `core/auth` — token encrypted with an Android Keystore AES-GCM key, stored in DataStore.
- `core/data` — `CachedApi` (cache-then-network reads, works offline read-only), `Mutations` (idempotent writes are queued offline in `core/sync/Outbox` and replayed by `SyncWorker` via WorkManager).
- `feature/*` — one package per area (today, quicklog, habits, plan, study, calendar, insights, settings), ViewModel + screens.
- `ui/` — design tokens (same as the web/Figma), components.

## Checks

```
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```
On this 7.5 GB machine keep Gradle builds one at a time (`gradle.properties` limits memory).

## Known limitations

- Offline: reading cached screens and idempotent logging (habits, task done, check-ins, sleep, focus) work offline; creating/deleting things and the study timer need a connection.
- No push reminders yet; no name/password change on mobile (use the website).
- Release signing and a production API URL aren't configured.
