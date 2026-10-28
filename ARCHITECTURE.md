# Whiteboard App Architecture

## Tech Stack

- Vue 3 (Options API) + TypeScript
- Vuetify 4 (UI component library)
- Vue Router 5 (Multi-view navigation)
- Pinia 4 (State management, using Options-style stores)
- Firebase Authentication (Google sign-in)
- Firebase Firestore (Cloud database)
- Vite (Build tooling) - single app, no monorepo/workspace (no backend services are planned)
- Vitest (Unit testing) + Vue Test Utils
- Playwright (End-to-end testing)
- Eslint 10 (Linting)

TypeScript is pinned to the 6.x line: TypeScript 7 (native compiler) does not expose the JS compiler API that `vue-tsc` requires.

## Views & Navigation

0. **Login View (`/login`)**
   - Google sign-in via Firebase Authentication.
   - Unauthenticated users are redirected here by a global route guard; after sign-in they return to the route they originally requested.
1. **Board Collection View (`/boards`)**
   - Displays a searchable grid of the boards the signed-in user has created (other users' boards are never listed).
   - Includes a search bar filtering by normalized lowercase title (`titleSearchable`). All of the user's boards are loaded once and filtered **in memory**, so a search matches anywhere in the title (case-insensitive), updates instantly, and costs no extra Firestore reads. Results are sorted by title (case-insensitive, numeric-aware, so "Sprint 9" comes before "Sprint 10"). The search term is kept while navigating to a board and back.
   - Revisit if users have very many or very large boards: listing downloads every board's full content. Possible next steps would be moving `content` to a separate document so the list stays small, then pagination plus a search service.
   - Dialog modal to create new boards (title required, max 100 characters). After creation the user is taken to the new board.
   - Empty states distinguish "no boards yet" from "no boards match the search".
2. **Single Board View (`/boards/:id`)**
   - Dynamic route loading a specific whiteboard. The board is fetched by the `id` route param, and the heading shows the board's title (a skeleton is shown while loading, never the id).
   - Only the board's owner may open it. A board that is missing or owned by someone else is treated identically (Firestore denies both): the view shows a "board not found" message with a link back to `/boards`.
   - Custom `v-sheet` styled to resemble a physical dry-erase board (aluminium frame, glossy sheen) with a marker font. The font stack uses faces already installed on macOS and Windows, so the board needs no web font.
   - Textarea for typing, auto-saved 800 ms after the last keystroke. Saves run one at a time and re-check the text afterwards, so text typed during a save is written too and writes can never land out of order.
   - Pending writing is flushed by the in-component route guards (and on unmount), so navigating away never loses an edit. Closing the tab mid-pause can still lose the last keystrokes; there is no `beforeunload` prompt.
   - A status next to the title reads "Saving…", "All changes saved", or an error with a Retry button. It stays empty on a board the user only reads.
   - Note that a Firestore write made while offline stays pending rather than failing, so the status reads "Saving…" until the connection returns; the error state is for rejected writes, such as a board that was deleted.
   - Do not worry about supporting free writing/drawing with the mouse or a touch screen for now.

`/` redirects to `/boards`. Routes requiring a session are flagged with `meta.requiresAuth`.

## Data Model (Firestore `boards` collection)

- `id`: string (auto-generated)
- `title`: string (trimmed, 1-100 characters)
- `titleSearchable`: string (lowercase `title`)
- `content`: string
- `createdAt`: `AuditStamp`
- `updatedAt`: `AuditStamp`

Where `AuditStamp` is `{ uid: string; time: Timestamp }` - who made the change and when.

The application/domain layer uses a storage-agnostic `Board` type (with `Date` instead of Firestore `Timestamp`). Conversion to and from Firestore documents happens only in the Firestore data-access layer, so no Firebase types leak into components or stores.

### Access Rules

Boards are private to their owner. The owner is the creator, identified by `createdAt.uid` (no separate owner field).

- Read, update, and delete are allowed only when `createdAt.uid` matches the signed-in user.
- List queries must filter on `where('createdAt.uid', '==', uid)`; unfiltered queries are rejected. This single-field equality query needs no composite index.
- On create, `createdAt` and `updatedAt` must both be stamped with the signed-in user's uid and the server time. On update, `createdAt` is immutable and `updatedAt` must be re-stamped by the owner.
- Rules are covered by tests in `tests/rules/`.

## Data Access

Components never call Firestore directly. The layers are:

- **`BoardRepository`** (`src/repositories/BoardRepository.ts`): storage interface scoped to one user, so callers never pass an owner. `list()`, `get(id)` (returns `null` for a missing board or another user's board), `create(input)`, and `update(id, changes)`. Unlike `get`, `update` rejects for a missing or someone else's board, so the view can report a failed save.
- **`FirestoreBoardRepository`**: the only implementation for now. Maps Firestore documents to the domain `Board` and applies the owner filter required by the rules.
- **`createBoardRepository(session)`** (`src/repositories/index.ts`): the single place that picks an implementation for a session (demo mode will branch here). Callers build a repository per use instead of keeping one, so it always matches the current session and no cache has to be invalidated on sign-in or sign-out. Implementations must therefore be **cheap to construct and hold no state between calls** - `FirestoreBoardRepository` is just a uid alongside the shared `db` singleton. A demo-mode implementation must read and write its store (e.g. `localStorage`) on each call rather than caching boards in a field.
- **`useBoardsStore`** (Pinia): holds all loaded boards, the search term, and loading/error state; the `visibleBoards` getter applies the search and sorting. It obtains a repository for the current session per call, discards a load that finishes after the session changed, and is reset on sign-out. `saveBoardContent(id, content)` lets errors propagate, because the board view owns the save status rather than the store.

## Future: Demo Mode (not yet implemented)

Users will be able to skip sign-in and use the app with changes kept in `localStorage` (or not persisted at all). The architecture accommodates this without changes to views:

- **Session abstraction**: the auth store exposes a "session" (signed-in user *or* demo user, uid `demo`). The route guard checks for a session, not specifically a Firebase user.
- **Repository swap**: a `LocalStorageBoardRepository` (or in-memory) implements the same `BoardRepository` interface and is selected when the session is a demo session.
- **Storage-agnostic types**: because the domain `Board` uses `Date`, a non-Firestore implementation needs no Firebase dependency.
- **Search needs no work**: it already runs in memory over `list()`, so a local implementation only has to return the boards.

## Local Development

- Development runs against the **Firebase Local Emulator Suite** (Auth + Firestore) using the `demo-whiteboard-app` project ID. The `demo-` prefix guarantees no real Firebase resources are touched.
- `VITE_USE_FIREBASE_EMULATORS=true` connects the SDK to the emulators. Real project config is supplied later via `.env.local` (not committed).
- Requires Java 21+ (for the Firestore emulator); `firebase-tools` is a dev dependency.
- New machine setup: `nvm install 26` and `nvm use 26` (nvm-windows does not read `.nvmrc`), `npm ci`, then `npx playwright install chromium`. The first emulator run downloads the emulator binaries.
- Run `npm run emulators` in one terminal and `npm run dev` in another. Emulator UI: http://127.0.0.1:4000.
- `npm run test:emulator` and `npm run test:e2e` start their own emulators through `scripts/with-emulators.ts` (run directly by Node's built-in TypeScript support). It replaces `firebase emulators:exec`, which on Windows left the Firestore emulator's Java process running and broke the next run with "port taken". Stop any `npm run emulators` session first, since both use the same ports.
- `npm run emulators:stop` (`scripts/stop-emulators.ts`) force-stops whatever is holding the emulator ports, for an `npm run emulators` session in another terminal or a leftover process from a crashed run. It reads the ports from `firebase.json` (plus the CLI's hub and logging ports) and only kills processes whose command line looks like a Firebase emulator, so an unrelated server on a shared port such as 8080 is reported and left alone.

## Testing

- **Unit tests** (Vitest, jsdom): colocated under `tests/unit/`, mirroring `src/`.
- **Emulator tests** (Vitest + `@firebase/rules-unit-testing`, `npm run test:emulator`): run in Node against the Firestore emulator with rules enforced.
  - `tests/rules/`: security rules.
  - `tests/integration/`: repository implementations, which also verifies their queries are allowed by the rules.
- **E2E tests** (Playwright): under `tests/e2e/`, run against the dev server backed by the emulators. `tests/e2e/support/auth.ts` signs in through the Auth emulator's Google popup with a unique user per test, so tests are isolated without clearing data.

## Linting

ESLint (flat config, `eslint.config.js`) with `typescript-eslint`, `eslint-plugin-vue` (`flat/recommended`), and `@stylistic` (semicolons, single quotes, 1tbs braces, always-parenthesized arrow params, no spaces inside object braces). Run `npm run lint` / `npm run lint:fix`.

## Known Quirks

- **Auth emulator popup**: on a freshly started Auth emulator, a sign-in popup sometimes ignores its submit button (no request is sent and the popup never closes). The E2E helper `tests/e2e/support/auth.ts` closes a stuck popup and retries. The emulator's form inputs also lack accessible names, so the helper selects them by id.
- **Vuetify and Vite pre-bundling**: `vuetify` is excluded from `optimizeDeps` in `vite.config.ts`. Otherwise, with a cold Vite cache, auto-imported components are discovered as pages load, and Vite re-optimizes and reloads the page mid-session, which breaks in-flight actions and E2E tests.
- **Leftover emulators on Windows**: `firebase emulators:exec` left the Firestore emulator's Java process running, hence `scripts/with-emulators.ts`. Its non-Windows path (process-group kill) has not yet been verified on macOS/Linux.
- **"Port taken" errors**: if a run fails with "port taken", run `npm run emulators:stop`. It clears a leftover `java` process on port 8080 or a running `npm run emulators` session; if it reports a port held by a non-emulator process, stop that process yourself.

## Project Status

Last updated 2026-10-28.

**Done**
- Scaffolding, tooling (ESLint, Vitest, Playwright), and Firebase emulator setup.
- Google sign-in with a route guard and post-login redirect; dismissing the popup is not treated as an error.
- Owner-only Firestore security rules with tests.
- Board data layer (`BoardRepository` with `list`, `get`, `create`) and the boards store.
- Board Collection View: in-memory substring search, board grid, create dialog, empty and error states.
- Single Board View: loads the board by id and shows its title, with loading, not-found, and error states.
- Single Board View editing: dry-erase styled `v-sheet`, debounced auto-save through `BoardRepository.update`, save status, and a flush when leaving the board.
- `npm run emulators:stop` to clear emulator ports left in use.

**Next**
- Nothing is in progress. Likely candidates, in no particular order:
  - Renaming and deleting a board (the rules already allow both for the owner; `update` takes a `BoardUpdateInput`, so a `title` field can be added to it).
  - Demo mode (see "Future: Demo Mode").

**Later**
- Demo mode (see "Future: Demo Mode").
- Real Firebase project config, once created (`.env.local`, from `.env.example`).
