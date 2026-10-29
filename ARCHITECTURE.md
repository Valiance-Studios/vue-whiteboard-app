# Whiteboard App Architecture

## Tech Stack

- Vue 3 (Options API) + TypeScript
- Vuetify 4 (UI component library)
- Vue Router 5 (Multi-view navigation)
- Tiptap 3 (the board's rich-text editor, used only for marker colors)
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
   - A **Demo Mode** button below Google sign-in starts demo mode (see "Demo Mode").
   - Only allowlisted accounts get a session (see "Access Rules"). Anyone else is signed straight back out, on sign-in and on page load alike, and the page says which account has no access.
1. **Board Collection View (`/boards`)**
   - Displays a searchable grid of the boards the signed-in user has created (other users' boards are never listed).
   - Each card previews the board as a small framed whiteboard in the marker font and the writing's own marker colors (the first 400 characters are rendered), with the title and last update below. The header shows a board count ("6 boards", or "2 of 6 boards" while searching).
   - Includes a search bar filtering by normalized lowercase title (`titleSearchable`). All of the user's boards are loaded once and filtered **in memory**, so a search matches anywhere in the title (case-insensitive), updates instantly, and costs no extra Firestore reads. Results are sorted by title (case-insensitive, numeric-aware, so "Sprint 9" comes before "Sprint 10"). The search term is kept while navigating to a board and back.
   - Revisit if users have very many or very large boards: listing downloads every board's full content. Possible next steps would be moving `content` to a separate document so the list stays small, then pagination plus a search service.
   - Dialog modal to create new boards (title required, max 100 characters). After creation the user is taken to the new board.
   - Each card has a pencil button (renames the board in the same title dialog, `BoardTitleDialog`, prefilled) and a trash button (deletes it after a confirmation, `DeleteBoardDialog`). The card is not itself a link, since a link cannot contain buttons: its title is the link, stretched over the card with an `::after` overlay, and the buttons sit above that overlay.
   - Empty states distinguish "no boards yet" from "no boards match the search".
2. **Single Board View (`/boards/:id`)**
   - Dynamic route loading a specific whiteboard. The board is fetched by the `id` route param, and the heading shows the board's title (a skeleton is shown while loading, never the id).
   - Only the board's owner may open it. A board that is missing or owned by someone else is treated identically (Firestore denies both): the view shows a "board not found" message with a link back to `/boards`.
   - A "My Boards" link above the title returns to the collection.
   - **Renaming**: clicking the title (a button inside the `h1`, with a pencil that appears on hover) turns it into a text field at the heading's size. Enter or leaving the field saves; Escape cancels; an unchanged title just closes it. A blank or too-long title, or a failed save, keeps the field open with the message under it. A rename is a write like any save, so it first waits for pending writing (`flushSave`) and the rules' 500 ms gap after the last write.
   - **Deleting**: a trash button across from the title, after a confirmation. It drops any unsaved writing, lets a save already running finish, deletes the board and returns to the collection.
   - `save()` returns the save in progress (`runningSave`) instead of returning at once when one is running, so renaming, deleting and leaving the board can all wait for it.
   - `WhiteboardSheet` is styled to resemble a physical dry-erase board (aluminium frame, glossy sheen) with a marker font. The font stack uses faces already installed on macOS and Windows, so the board needs no web font.
   - **Marker tray** (`MarkerTray`): an aluminium ledge under the board holding six markers (black, blue, red, green, purple, orange; `src/constants/markers.ts`). The marker in hand is lifted and named ("Marker · Red"). Picking one recolors the selected text, if any, and colors everything written from then on, so a board can mix colors. Each visit starts with blue.
   - **Editor**: a Tiptap editor limited to plain lines of colored text (`src/editor/`: document, paragraph, text, the `Ink` mark, undo/redo, placeholder, `ContentLimit`). There is no bold, headings or lists. Tiptap's document format stays inside `WhiteboardSheet` and `src/editor/`: the sheet takes and emits a `BoardWriting` (`content` plus ink runs), so the rest of the app never sees it.
   - The `Ink` mark's plugin keeps the current ink in ProseMirror's stored marks after every change, so typing anywhere, even inside text of another color, writes in the marker in hand. Pasted and dropped text is recolored to it. Text a change brings in with no ink at all (ProseMirror reads some typing back from the DOM, e.g. typing over a select-all, which skips stored marks) gets it as well, so no text is ever uncolored. Undo restores the earlier colors.
   - At most 100,000 characters, counting each line break (`ContentLimit`; Tiptap's CharacterCount does not count line breaks). Writing is auto-saved 800 ms after the last keystroke. Saves run one at a time and re-check the text afterwards, so text typed during a save is written too and writes can never land out of order.
   - Writes to a board are kept at least 500 ms apart (`BOARD_MIN_SAVE_INTERVAL_MS`), counted from when the previous write was acknowledged, because the rules reject writes that come closer together. Usually only a save of text typed during the previous save waits.
   - Pending writing is flushed by the in-component route guards (and on unmount), so navigating away never loses an edit. Closing the tab mid-pause can still lose the last keystrokes; there is no `beforeunload` prompt.
   - A status next to the title reads "Saving…", "All changes saved", or an error with a Retry button. It stays empty on a board the user only reads.
   - Note that a Firestore write made while offline stays pending rather than failing, so the status reads "Saving…" until the connection returns; the error state is for rejected writes, such as a board that was deleted.
   - Do not worry about supporting free writing/drawing with the mouse or a touch screen for now.

Every page shares an app bar with the marker logo on the left and the theme toggle on the right. Once signed in, the toggle is followed by the user's Google photo (or initial) and name, a "Demo" chip in demo mode, and Sign out. On phones the name is hidden and Sign out shows only its icon (keeping "Sign out" as its accessible name), so the title is not squeezed out.

`/` redirects to `/boards`. Routes requiring a session are flagged with `meta.requiresAuth`.

## Data Model (Firestore `boards` collection)

Boards live in the **named** Firestore database `vue-whiteboard-app`, not the project's `(default)` database, because the Firebase project is shared with other Valiance Studios apps. The id comes from `VITE_FIREBASE_DATABASE_ID`; empty means `(default)`.

- `id`: string (auto-generated)
- `title`: string (trimmed, 1-100 characters)
- `titleSearchable`: string (lowercase `title`)
- `content`: string (plain text; lines separated by `\n`)
- `inks`: string, optional: the marker color of every character in `content`, as runs, e.g. `blue:24,red:7` (`encodeInks`/`decodeInks` in `src/utils/inks.ts`). Boards without it, or with runs that do not fit `content`, read as the default ink (blue) for the uncovered text rather than failing. A line break takes the ink of the text before it.
- `createdAt`: `AuditStamp`
- `updatedAt`: `AuditStamp`

Where `AuditStamp` is `{ uid: string; time: Timestamp }` - who made the change and when.

### `allowedUsers` collection

The accounts allowed to use Firestore. Each document's id is a **lowercase** email address; the document has no fields. It is managed by hand in the Firebase console (no client can write to it), and `hasFirestoreAccess` in `src/firebase/access.ts` reads the signed-in user's own entry.

In the domain types, `BoardWriting` is `{ content: string; inks: InkRun[] }` with `InkRun` `{ ink: MarkerInk; length: number }`; runs are kept normalized (covering `content` exactly, no empty runs, neighbours of different inks). `Board` extends it, and `BoardUpdateInput` is it.

The application/domain layer uses a storage-agnostic `Board` type (with `Date` instead of Firestore `Timestamp`). Conversion to and from Firestore documents happens only in the Firestore data-access layer, so no Firebase types leak into components or stores.

### Access Rules

Signing in with Google is open to anyone, so the rules, not the client, are what stop strangers from writing to Firestore. Client-side checks (the access check, the save debounce and spacing, the textarea's max length) only make the app behave well for honest users; anyone signed in can call the Firestore SDK directly with their own token.

- Every board operation requires an **allowlisted, verified email**: `request.auth.token.email_verified` is true and `allowedUsers/<lowercase email>` exists. Removing an entry locks the user out immediately, whereas disabling their Auth account leaves their token valid for up to an hour.
- Users may `get` only their own `allowedUsers` entry, so the client can tell whether it has access (a missing entry reads as "no access", not an error). Listing and writing the allowlist are denied.
- `content` is capped at 100,000 characters (`BOARD_CONTENT_MAX_LENGTH`), so no write can approach Firestore's 1 MiB document limit.
- `inks`, when present, must be well-formed runs of the six known inks and at most 20,000 characters long (`BOARD_INKS_MAX_LENGTH`, about 2,000 color changes). Rules cannot check that the runs add up to the length of `content`; the client tolerates a mismatch.
- An update must come more than 500 ms after the board's last write (`updatedAt.time`). The first edit after a board is created is exempt (detected by `updatedAt == createdAt`), so writing straight away on a new board, or leaving it right after, is never rejected.
- Not limited: how many boards a user creates, and reads, which rules cannot rate-limit. The allowlist is the protection for both. A per-user board cap would need a counter document checked with `getAfter()` in a batched write, and is only worth adding if an allowlisted account is abused.

Boards are private to their owner. The owner is the creator, identified by `createdAt.uid` (no separate owner field).

- Read, update, and delete are allowed only when `createdAt.uid` matches the signed-in user.
- List queries must filter on `where('createdAt.uid', '==', uid)`; unfiltered queries are rejected. This single-field equality query needs no composite index.
- On create, `createdAt` and `updatedAt` must both be stamped with the signed-in user's uid and the server time. On update, `createdAt` is immutable and `updatedAt` must be re-stamped by the owner.
- Rules are covered by tests in `tests/rules/`.

## Data Access

Components never call Firestore directly. The layers are:

- **`BoardRepository`** (`src/repositories/BoardRepository.ts`): storage interface scoped to one user, so callers never pass an owner. `list()`, `get(id)` (returns `null` for a missing board or another user's board), `create(input)`, `update(id, changes)`, `rename(id, title)` and `delete(id)`. Unlike `get`, the writes reject for a missing or someone else's board, so the view can report the failure. `rename` trims the title and re-stamps `updatedAt`; a Firestore rename is an ordinary update, so the rules check the title and the write interval as for any update.
- **`FirestoreBoardRepository`**: the only implementation for now. Maps Firestore documents to the domain `Board` and applies the owner filter required by the rules.
- **`createBoardRepository(session)`** (`src/repositories/index.ts`): the single place that picks an implementation for a session: `FirestoreBoardRepository` for Google accounts, `LocalStorageBoardRepository` for demo mode. Callers build a repository per use instead of keeping one, so it always matches the current session and no cache has to be invalidated on sign-in or sign-out. Implementations must therefore be **cheap to construct and hold no state between calls** - `FirestoreBoardRepository` is just a uid alongside the shared `db` singleton. `LocalStorageBoardRepository` likewise reads and writes `localStorage` on each call rather than caching boards in a field.
- **`useBoardsStore`** (Pinia): holds all loaded boards, the search term, and loading/error state; the `visibleBoards` getter applies the search and sorting. It obtains a repository for the current session per call, discards a load that finishes after the session changed, and is reset on sign-out. `renameBoard` and `deleteBoard` update the loaded list only after the repository succeeds. `saveBoardWriting(id, writing)`, `renameBoard` and `deleteBoard` let errors propagate, because the views own the save status and dialogs rather than the store.

## Demo Mode

Visitors can use the app without an account, with their boards kept in this browser's `localStorage`. Everything after the login page works the same as for a Google account; the views do not know which kind of session they are in.

- **Starting**: the login page's **Demo Mode** button. A first-time visitor is asked for a name (`DemoModeDialog`, required, at most 50 characters), which becomes the session's `displayName`. A returning visitor in the same browser goes straight in under their saved name; under the Demo Mode button, the login card greets them in a tinted panel (their initial, "Welcome back, Grace") with a **Not you?** button. That asks someone new for a name, warning that starting deletes the previous visitor's demo boards (`enterDemoAsSomeoneNew`, which calls `clearDemoBoards`); cancelling keeps everything.
- **Session**: `SessionUser.kind` is `'google'` or `'demo'`. A demo session has uid `demo`, no email and no photo. The auth store's `enterDemo(name?)` starts one (returning `false` when there is no name given or saved, so the login page can ask), and the `isDemo` getter drives the app bar's "Demo" chip. The route guard only checks for a session, so demo sessions pass it.
- **Profile** (`DemoProfileStorage`, key `whiteboard.demo.profile`): `{displayName, active}`. `active` is what keeps a demo session across reloads: `init()` resumes it before Firebase reports its (empty) auth state, and Firebase reporting no user does not end a demo session. Signing out clears `active` but keeps the name and the boards, which is how the next visit skips the name prompt. An unreadable profile counts as none.
- **Boards** (`LocalStorageBoardRepository`, key `whiteboard.demo.boards`): a JSON array of boards, dates as ISO strings and inks as runs, re-normalized on read. Methods are `async`, so a storage error such as a full quota (browsers allow roughly 5 MB per origin) rejects and shows as a failed save. There are no Firestore rules here; the views' own limits (title length, content length) still apply.
- **Not covered**: a demo visitor cannot carry their boards into a Google account, and clearing site data deletes them. Demo writes still wait out the 500 ms save interval meant for Firestore, which is harmless.

## Local Development

- Development runs against the **Firebase Local Emulator Suite** (Auth + Firestore) using the `demo-whiteboard-app` project ID. The `demo-` prefix guarantees no real Firebase resources are touched.
- `VITE_USE_FIREBASE_EMULATORS=true` connects the SDK to the emulators. Real project config is supplied later via `.env.local` (not committed).
- Requires Java 21+ (for the Firestore emulator); `firebase-tools` is a dev dependency.
- New machine setup: `nvm install 26` and `nvm use 26` (nvm-windows does not read `.nvmrc`), `npm ci`, then `npx playwright install chromium`. The first emulator run downloads the emulator binaries.
- Run `npm run emulators` in one terminal and `npm run dev` in another. Emulator UI: http://127.0.0.1:4000. Stop the emulators with Ctrl+C.
- `npm run emulators` seeds the emulators on every start (`scripts/seed-emulators.ts`, since emulator data is not kept between runs) with **Dev User (`dev@example.com`)**, a verified Google account that is on the allowlist. Pick it under "Choose an account" in the sign-in popup. The rules are not relaxed for local work: the account is allowlisted just as one would be in production, so local development runs against the deployed rules. To try another account, add `allowedUsers/<lowercase email>` (no fields) in the Emulator UI's Firestore tab on the `vue-whiteboard-app` database; a new account without an entry shows the "no access" message.
- `scripts/emulator-admin.ts` holds the admin helpers the seed and the E2E tests share (`allowEmail`, `createGoogleAccount`). They call the emulators' REST APIs with the `Bearer owner` admin token, take the project, database and ports from `.env.development` and `firebase.json`, and refuse to run against a project id without the `demo-` prefix.
- `npm run test:emulator` and `npm run test:e2e` start their own emulators through `scripts/with-emulators.ts` (run directly by Node's built-in TypeScript support). `npm run emulators` uses the same script with `--keep-running`, which leaves the emulators up (showing their output) after the seed succeeds, until Ctrl+C. It replaces `firebase emulators:exec`, which on Windows left the Firestore emulator's Java process running and broke the next run with "port taken". Stop any `npm run emulators` session first, since both use the same ports.
- `npm run emulators:stop` (`scripts/stop-emulators.ts`) force-stops whatever is holding the emulator ports, for an `npm run emulators` session in another terminal or a leftover process from a crashed run. It reads the ports from `firebase.json` (plus the CLI's hub and logging ports) and only kills processes whose command line looks like a Firebase emulator, so an unrelated server on a shared port such as 8080 is reported and left alone.

## Deployment

Firebase Hosting, deployed manually, to the dev project `vs-valiance-studios-dev` (`dev` alias in `.firebaserc`). There is no production project yet; adding one means another alias and another `.env` file, not a rework. `default` stays the `demo-whiteboard-app` emulator project so a stray `firebase` command cannot reach real infrastructure.

- **First-time setup**: `firebase login`, then copy `.env.example` to `.env.production.local` and fill it in from the `vue-whiteboard-app-dev` web app config. Use `.env.production.local`, not `.env.local`: Vite loads `.env.local` in every mode, so real credentials there would point `npm run dev` and the E2E tests at real Firebase instead of the emulators.
- **Allowlist**: before the first rules deploy, add `allowedUsers/<lowercase email>` (no fields) to the `vue-whiteboard-app` database in the Firebase console for each person who should have access, or everyone, including you, is locked out. Add and remove people the same way later; no deploy is needed.
- **Deploy**: `npm run deploy` (hosting + Firestore rules and indexes), or `npm run deploy:hosting` / `npm run deploy:rules` for one of them. All three are pinned to `--project dev`. `firebase deploy --dry-run` validates a deploy, including the predeploy build and rules compilation, without publishing.
- The app has its **own Hosting site**, `vs-valiance-studios-dev-whiteboard` (`hosting.site` in `firebase.json`), served at https://vs-valiance-studios-dev-whiteboard.web.app. The project's default site is left free for other Valiance Studios apps, and deploys here cannot affect them. A custom domain, if one is wanted later, attaches to this site without redeploying.
- `hosting.predeploy` runs `scripts/check-firebase-config.ts` and then the build, so a deploy fails early if the config is missing or still points at the emulators, rather than serving an app that cannot reach Firebase. `npm run build` on its own needs no credentials, since it doubles as the type and bundle check.
- The `firestore` entry in `firebase.json` is the **array form with an explicit `database`**, so a rules deploy can only ever reach `vue-whiteboard-app`. The single-object form would deploy to `(default)` and could overwrite another app's rules in the shared project.
- SPA routing needs the `**` → `/index.html` rewrite, or reloading `/boards/:id` would 404. Hashed assets under `/assets` are served immutable for a year; `index.html` is not cached.
- After the first deploy, add the hosting domain to **Authentication > Settings > Authorized domains** if a custom domain is used. `*.web.app` and `*.firebaseapp.com` are authorized automatically.
- The Hosting emulator is deliberately not part of `npm run emulators` (`--only auth,firestore`): local work is served by Vite on port 5173, and the Hosting emulator would serve a stale `dist`.

## Testing

- **Unit tests** (Vitest, jsdom): colocated under `tests/unit/`, mirroring `src/`. `tests/unit/editor/` drives a real Tiptap editor in jsdom; jsdom has no `ClipboardEvent`, so the paste test dispatches the transaction ProseMirror's paste handler would.
- `tsconfig.vitest.json` inherits the app's `lib` (ES2022 + DOM). The create-vue template's `"lib": []` relied on `jsdom` types this project does not install, which left code under `src/` without ES2022 or DOM types when type-checked for tests.
- **Emulator tests** (Vitest + `@firebase/rules-unit-testing`, `npm run test:emulator`): run in Node against the Firestore emulator with rules enforced. These run against `(default)` rather than the named database, because `@firebase/rules-unit-testing` cannot target a named one. That is harmless: the suite uploads `firestore.rules` to the emulator itself, so it tests the same rules file that is deployed. Dev and the E2E tests do use the named database, so the `getFirestore(app, id)` path is covered.
  - `tests/rules/`: security rules.
  - `tests/integration/`: repository implementations, which also verifies their queries are allowed by the rules.
- **E2E tests** (Playwright): under `tests/e2e/`, run against the dev server backed by the emulators. `tests/e2e/support/auth.ts` signs in through the Auth emulator's Google popup with a unique user per test, so tests are isolated without clearing data. `signIn` first allowlists the user with `allowEmail` from `scripts/emulator-admin.ts`, which bypasses the rules; `submitSignIn` goes through the popup without doing so, for testing denied access. The board is a `contenteditable`, not a textarea, so `tests/e2e/support/boards.ts` writes with `writeOnBoard` (select all, then type line by line) and reads lines with `boardLines` (one `<p>` each) and colors with `inkedText(page, ink)`.

## Styling

- Two Vuetify themes, `light` and `dark` (`src/plugins/vuetify.ts`). Light sets marker blue `#1f3b73` as `primary` on a cool-grey background; dark lightens it to `#9bb7ee` (with dark text on it) on near-black surfaces.
- **Theme toggle** (`ThemeToggle`): a sun/moon button at the right edge of the app bar. On the login page it is the only control there; once signed in it sits just left of the avatar. Until the visitor picks a theme the app follows the system setting (`defaultTheme: 'system'`, which tracks changes live); a pick is saved to `localStorage` (`whiteboard.theme`, `src/theme/themePreference.ts`) and wins over the system from then on. The saved theme is read when Vuetify is created, before the first render, so it never flashes the other theme.
- **The boards stay white in the dark theme**: they are whiteboards, and the marker inks are chosen for white. So anything drawn on a board (e.g. the card's "Empty board") sets its own color rather than inheriting the theme's text color, which is light in the dark theme.
- Vuetify's theme variables are comma-separated channels (`--v-theme-primary: 31,59,115`), so a translucent theme color is `rgba(var(--v-theme-primary), 0.08)`. The slash form, `rgb(var(--v-theme-primary) / 8%)`, mixes the two syntaxes; browsers drop it silently and the color never shows.
- The dry-erase look (marker font stack, aluminium frame and glossy surface) lives in `src/styles/_board.scss`. Marker colors live in code (`src/constants/markers.ts`), because the editor and the previews need them there. Components pull it in with `@use '@/styles/board';` (the `@/` alias works in Sass too), so the board view and the collection's previews cannot drift apart.

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
- Firebase Hosting deployment to the dev project, with the app pointed at the named `vue-whiteboard-app` database.
- Firestore safeguards: an email allowlist for all board access (with a "no access" message on the login page), a board content size cap, and a minimum gap between writes to one board. `npm run emulators` seeds an allowlisted Dev User for local work.
- Visual refresh of the app bar and Board Collection View: a custom Vuetify theme, whiteboard-style board cards, and a board count.
- Marker tray and multi-color writing on the Single Board View (a Tiptap editor), with colors stored as `inks` runs and shown in the collection previews.
- Demo Mode: a name-only session from the login page, with boards kept in `localStorage`; returning visitors go straight in.
- Renaming and deleting boards, from the board cards and from the board page.
- Light and dark themes, with a toggle in the app bar; follows the system setting until one is picked.

**Next**
- First manual deploy (`npm run deploy`) once `.env.production.local` exists and the allowlist has an entry for you, then a sign-in smoke test on the hosted URL.
- Before wider use: App Check (reCAPTCHA Enterprise) enforced for Firestore, so only the real web app can call it, and a budget alert on the project's billing account.

**Later**
- Real Firebase project config, once created (`.env.local`, from `.env.example`).
