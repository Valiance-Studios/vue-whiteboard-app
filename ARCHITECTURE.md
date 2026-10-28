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
   - Custom `v-sheet` styled to resemble a physical dry-erase board with an expo-marker font.
   - Textarea for typing with debounced auto-saving to Firestore.
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

- **`BoardRepository`** (`src/repositories/BoardRepository.ts`): storage interface scoped to one user, so callers never pass an owner. Currently `list()`, `get(id)` (returns `null` for a missing board or another user's board), and `create(input)`; `update` will be added with board editing.
- **`FirestoreBoardRepository`**: the only implementation for now. Maps Firestore documents to the domain `Board` and applies the owner filter required by the rules.
- **`createBoardRepository(session)`** (`src/repositories/index.ts`): the single place that picks an implementation for a session (demo mode will branch here).
- **`useBoardsStore`** (Pinia): holds all loaded boards, the search term, and loading/error state; the `visibleBoards` getter applies the search and sorting. It obtains a repository for the current session per call, discards a load that finishes after the session changed, and is reset on sign-out.

## Future: Demo Mode (not yet implemented)

Users will be able to skip sign-in and use the app with changes kept in `localStorage` (or not persisted at all). The architecture accommodates this without changes to views:

- **Session abstraction**: the auth store exposes a "session" (signed-in user *or* demo user, uid `demo`). The route guard checks for a session, not specifically a Firebase user.
- **Repository swap**: a `LocalStorageBoardRepository` (or in-memory) implements the same `BoardRepository` interface and is selected when the session is a demo session.
- **Storage-agnostic types**: because the domain `Board` uses `Date`, a non-Firestore implementation needs no Firebase dependency.
- **Search needs no work**: it already runs in memory over `list()`, so a local implementation only has to return the boards.

## Local Development

- Development runs against the **Firebase Local Emulator Suite** (Auth + Firestore) using the `demo-whiteboard-app` project ID. The `demo-` prefix guarantees no real Firebase resources are touched.
- `VITE_USE_FIREBASE_EMULATORS=true` connects the SDK to the emulators. Real project config is supplied later via `.env.local` (not committed).
- Requires Java (for the Firestore emulator); `firebase-tools` is a dev dependency.
- Run `npm run emulators` in one terminal and `npm run dev` in another. Emulator UI: http://127.0.0.1:4000.
- `npm run test:emulator` and `npm run test:e2e` start their own emulators through `scripts/with-emulators.ts` (run directly by Node's built-in TypeScript support). It replaces `firebase emulators:exec`, which on Windows left the Firestore emulator's Java process running and broke the next run with "port taken". Stop any `npm run emulators` session first, since both use the same ports.

## Testing

- **Unit tests** (Vitest, jsdom): colocated under `tests/unit/`, mirroring `src/`.
- **Emulator tests** (Vitest + `@firebase/rules-unit-testing`, `npm run test:emulator`): run in Node against the Firestore emulator with rules enforced.
  - `tests/rules/`: security rules.
  - `tests/integration/`: repository implementations, which also verifies their queries are allowed by the rules.
- **E2E tests** (Playwright): under `tests/e2e/`, run against the dev server backed by the emulators. `tests/e2e/support/auth.ts` signs in through the Auth emulator's Google popup with a unique user per test, so tests are isolated without clearing data.

## Linting

ESLint (flat config, `eslint.config.js`) with `typescript-eslint`, `eslint-plugin-vue` (`flat/recommended`), and `@stylistic` (semicolons, single quotes, 1tbs braces, always-parenthesized arrow params, no spaces inside object braces). Run `npm run lint` / `npm run lint:fix`.
