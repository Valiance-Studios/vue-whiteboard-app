# Development Guide

Setting up a machine, running the app, testing, and known quirks. The diagram under "Environments and Delivery" in [ARCHITECTURE.md](../ARCHITECTURE.md#environments-and-delivery) shows which command talks to which backend.

## Setup

- Requires Java 21+ (for the Firestore emulator); `firebase-tools` is a dev dependency.
- New machine: `nvm install 26` and `nvm use 26` (nvm-windows does not read `.nvmrc`), `npm ci`, then `npx playwright install chromium`. The first emulator run downloads the emulator binaries.

## Running Locally

- Development runs against the **Firebase Local Emulator Suite** (Auth + Firestore) using the `demo-whiteboard-app` project ID. The `demo-` prefix guarantees no real Firebase resources are touched.
- `VITE_USE_FIREBASE_EMULATORS=true` (in `.env.development`) connects the SDK to the emulators.
- Run `npm run emulators` in one terminal and `npm run dev` in another. Emulator UI: http://127.0.0.1:4000. Stop the emulators with Ctrl+C.
- `npm run dev:staging` runs the dev server against the hosted dev project instead (`.env.staging`), with real Google sign-in and the real allowlist. It needs an App Check debug token in `.env.staging.local` (see "Debug Token" in [DEPLOYMENT.md](DEPLOYMENT.md#debug-token)).

### Seed Data

`npm run emulators` seeds the emulators on every start (`scripts/seed-emulators.ts`, since emulator data is not kept between runs) with **Dev User (`dev@example.com`)**, a verified Google account that is on the allowlist and has a profile photo (`PLACEHOLDER_PHOTO_URL`, a data URL of `scripts/assets/placeholder-photo.svg`, so it loads offline and never ships with the app). Pick it under "Choose an account" in the sign-in popup.

- A real Google account cannot sign in locally, since sign-in goes through the Auth emulator. To see the initial instead of a photo, add an account in the popup and leave "Profile photo URL" empty.
- The rules are not relaxed for local work: the account is allowlisted just as one would be in production, so local development runs against the deployed rules.
- To try another account, add `allowedUsers/<lowercase email>` (no fields) in the Emulator UI's Firestore tab on the `vue-whiteboard-app` database; a new account without an entry shows the "no access" message.

### Emulator Scripts

- `scripts/emulator-admin.ts` holds the admin helpers the seed and the E2E tests share (`allowEmail`, `createGoogleAccount`). They call the emulators' REST APIs with the `Bearer owner` admin token, take the project, database and ports from `.env.development` and `firebase.json`, and refuse to run against a project id without the `demo-` prefix.
- `npm run test:emulator` and `npm run test:e2e` start their own emulators through `scripts/with-emulators.ts` (run directly by Node's built-in TypeScript support). `npm run emulators` uses the same script with `--keep-running`, which leaves the emulators up (showing their output) after the seed succeeds, until Ctrl+C. It replaces `firebase emulators:exec`, which on Windows left the Firestore emulator's Java process running and broke the next run with "port taken". Stop any `npm run emulators` session first, since both use the same ports.
- `npm run emulators:stop` (`scripts/stop-emulators.ts`) stops this project's emulators, for an `npm run emulators` session in another terminal or a leftover process from a crashed run. It finds them by command line, not by port: `with-emulators.ts`, the Firebase CLI and the Firestore emulator's Java process, each naming the emulator project id (the default in `.firebaserc`). It then checks that the ports from `firebase.json` (plus the CLI's hub and logging ports) are free by connecting to them on `127.0.0.1` and `::1`. An unrelated server on a shared port such as 8080 is never stopped; it is reported, and the script exits with an error.

## Environment Files

One file per Vite mode, with no bare `.env` (Vite loads `.env` and `.env.local` in every mode, so real config there would point `npm run dev` and the E2E tests at real Firebase). Vite does not layer modes, so each file holds a complete config.

| File | Committed | Used for |
| --- | --- | --- |
| `.env.development` | Yes | The emulators (`demo-whiteboard-app`): `npm run dev`, the seed, and the E2E tests. Vite's default mode. |
| `.env.staging` | Yes | The app hosted in the dev project (`vs-valiance-studios-dev`): `npm run dev:staging`, `npm run build:staging`, and every deploy. Firebase web config is compiled into the public site, so it is not secret. |
| `.env.production` | Yes | Reserved for a future production project. None exists yet ("staging is production"), so it is empty and nothing builds with it. |
| `.env.example` | Yes | Template for a new env file. |
| `.env.<mode>.local` | No | Personal, machine-specific overrides of the matching mode, such as the App Check debug token in `.env.staging.local`. |

Never put real secrets in `VITE_` variables; they end up in the bundle.

## Testing

- **Unit tests** (Vitest, jsdom): under `tests/unit/`, mirroring `src/`. `tests/unit/editor/` drives a real Tiptap editor in jsdom; jsdom has no `ClipboardEvent`, so the paste test dispatches the transaction ProseMirror's paste handler would.
- `tsconfig.vitest.json` inherits the app's `lib` (ES2022 + DOM). The create-vue template's `"lib": []` relied on `jsdom` types this project does not install, which left code under `src/` without ES2022 or DOM types when type-checked for tests.
- **Emulator tests** (Vitest + `@firebase/rules-unit-testing`, `npm run test:emulator`): run in Node against the Firestore emulator with rules enforced. These run against `(default)` rather than the named database, because `@firebase/rules-unit-testing` cannot target a named one. That is harmless: the suite uploads `firestore.rules` to the emulator itself, so it tests the same rules file that is deployed. Dev and the E2E tests do use the named database, so the `getFirestore(app, id)` path is covered.
  - `tests/rules/`: security rules.
  - `tests/integration/`: repository implementations, which also verifies their queries are allowed by the rules.
- **E2E tests** (Playwright): under `tests/e2e/`, run against a dev server backed by the emulators. Playwright always starts its own, in the `development` mode on port 5174, and never reuses a running one, so a dev server on port 5173 (even `npm run dev:staging`) can stay up during a run. If port 5174 is taken, the run fails at once (`strictPort`) rather than testing whatever is listening there.
  - `tests/e2e/support/auth.ts` signs in through the Auth emulator's Google popup with a unique user per test, so tests are isolated without clearing data. `signIn` first allowlists the user with `allowEmail` from `scripts/emulator-admin.ts`, which bypasses the rules; `submitSignIn` goes through the popup without doing so, for testing denied access. A `TestUser` with a `photoUrl` fills the popup's "Profile photo URL" field (`tests/e2e/app-bar.spec.ts` covers the avatar's photo and initial).
  - The board is a `contenteditable`, not a textarea, so `tests/e2e/support/boards.ts` writes with `writeOnBoard` (select all, then type line by line) and reads lines with `boardLines` (one `<p>` each) and colors with `inkedText(page, ink)`.

## Linting

ESLint (flat config, `eslint.config.js`) with `typescript-eslint`, `eslint-plugin-vue` (`flat/recommended`), and `@stylistic` (semicolons, single quotes, 1tbs braces, always-parenthesized arrow params, no spaces inside object braces). Run `npm run lint` / `npm run lint:fix`.

## Known Quirks

- **Auth emulator popup**: on a freshly started Auth emulator, a sign-in popup sometimes ignores its submit button (no request is sent and the popup never closes). The E2E helper `tests/e2e/support/auth.ts` closes a stuck popup and retries. The emulator's form inputs also lack accessible names, so the helper selects them by id.
- **Vuetify and Vite pre-bundling**: `vuetify` is excluded from `optimizeDeps` in `vite.config.ts`. Otherwise, with a cold Vite cache, auto-imported components are discovered as pages load, and Vite re-optimizes and reloads the page mid-session, which breaks in-flight actions and E2E tests.
- **Leftover emulators**: `firebase emulators:exec` left the Firestore emulator's Java process running on Windows, hence `scripts/with-emulators.ts`, which stops the emulators' whole process tree (`taskkill /T` on Windows, a process-group kill elsewhere; the latter verified on macOS). It stops them on Ctrl+C, a kill (SIGTERM) and a hang-up (SIGHUP), which is what closing the terminal or IDE task running `npm run emulators` sends. Before SIGHUP was handled, closing that terminal killed only the script and left the emulators running unparented: the CLI later exited, and the Firestore emulator's Java process kept port 8080, so every E2E sign-in hung for want of the Auth emulator. `npm run emulators:stop` clears such leftovers.
- **"Port taken" errors**: if a run fails with "port taken", run `npm run emulators:stop`. It clears a leftover `java` process on port 8080 or a running `npm run emulators` session; if it reports a port held by something else, stop that process yourself. A run that fails this way leaves nothing behind.
- **Port listings on Windows**: `netstat` and `Get-NetTCPConnection` were seen listing only a varying few of the emulators' listening sockets (each port in at most 1 of 10 samples), and `netstat -p TCP` omits IPv6, where the hub listens (`::1:4400`). `emulators:stop` used to find emulators that way and sometimes reported them stopped while they still ran, so it now finds them by command line and probes the ports by connecting. It is unconfirmed whether the flaky listings happen outside Claude Code's sandboxed shell.
- **TypeScript version**: pinned to the 6.x line, because TypeScript 7 (native compiler) does not expose the JS compiler API that `vue-tsc` requires.
- **Dependency overrides** (`overrides` in `package.json`): three nested packages are forced past versions with security advisories that their parents still pin. Each only runs under Node (tests and the Firebase CLI), never in the browser bundle, and each override was checked against what the parent uses:
  - `@grpc/grpc-js` ^1.14.6 under `@firebase/firestore`, which pins ~1.9 even in its latest release. The SDK uses gRPC only in Node (the emulator tests); the browser build talks to Firestore over WebChannel. The emulator tests exercise it.
  - `@opentelemetry/core` ^2.8.0 under `@google-cloud/pubsub` 5 (from `firebase-tools`), which only uses its `W3CTraceContextPropagator`.
  - `uuid` ^11.1.1 under `gaxios` 6 (from `firebase-tools`), which only calls `v4()`.

  When updating Firebase or `firebase-tools`, check whether the parents have caught up (`npm ls @grpc/grpc-js @opentelemetry/core uuid`) and drop overrides that are no longer needed; `npm audit` should stay at 0.
