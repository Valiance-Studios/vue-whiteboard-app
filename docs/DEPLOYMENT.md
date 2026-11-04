# Deployment and App Check Operations

How to deploy, and how to set up App Check in the consoles. The pipeline diagram is under "Environments and Delivery" in [ARCHITECTURE.md](../ARCHITECTURE.md#environments-and-delivery), and what App Check protects is under "Security" there.

## Deployment

Firebase Hosting, deployed manually, to the dev project `vs-valiance-studios-dev` (`dev` alias in `.firebaserc`). There is no production project yet, so deploys build in the `staging` mode (`.env.staging`); adding production means another alias and filling in `.env.production`, not a rework. `default` stays the `demo-whiteboard-app` emulator project so a stray `firebase` command cannot reach real infrastructure.

- **First-time setup**: `firebase login`. The web app config and App Check site key are already in the committed `.env.staging`.
- **Allowlist**: before the first rules deploy, add `allowedUsers/<lowercase email>` (no fields) to the `vue-whiteboard-app` database in the Firebase console for each person who should have access, or everyone, including you, is locked out. Add and remove people the same way later; no deploy is needed.
- **Deploy**: `npm run deploy` (hosting + Firestore rules and indexes), or `npm run deploy:hosting` / `npm run deploy:rules` for one of them. All three are pinned to `--project dev`. `firebase deploy --dry-run` validates a deploy, including the predeploy build and rules compilation, without publishing.
- **Own Hosting site**: `vs-valiance-studios-dev-whiteboard` (`hosting.site` in `firebase.json`), served at https://vs-valiance-studios-dev-whiteboard.web.app. The project's default site is left free for other Valiance Studios apps, and deploys here cannot affect them. A custom domain, if one is wanted later, attaches to this site without redeploying.
- **Predeploy checks**: `hosting.predeploy` runs `node scripts/check-firebase-config.ts staging` and then `npm run build:staging` (`vite build --mode staging`), so a deploy fails early if the config, the database id or the App Check site key is missing, the config points at the emulators, or an App Check debug token is set (from `.env.staging.local`), rather than serving an app that cannot reach Firebase or that anyone could get past App Check with. Remove or rename `.env.staging.local` before deploying. `npm run build` on its own builds the `production` mode, which needs no credentials, since it doubles as the type and bundle check.
- **Rules target**: the `firestore` entry in `firebase.json` is the **array form with an explicit `database`**, so a rules deploy can only ever reach `vue-whiteboard-app`. The single-object form would deploy to `(default)` and could overwrite another app's rules in the shared project.
- **Hosting behavior**: SPA routing needs the `**` → `/index.html` rewrite, or reloading `/boards/:id` would 404. Hashed assets under `/assets` are served immutable for a year; `index.html` is not cached.
- **Authorized domains**: after the first deploy, add the hosting domain to **Authentication > Settings > Authorized domains** if a custom domain is used. `*.web.app` and `*.firebaseapp.com` are authorized automatically.
- **No Hosting emulator**: it is deliberately not part of `npm run emulators` (`--only auth,firestore`): local work is served by Vite on port 5173, and the Hosting emulator would serve a stale `dist`.

## App Check Setup

### Console Setup

Steps 1 to 3 are for each new app, and step 4 is once per project. A future production project repeats them with its own key; the code does not change.

1. Google Cloud console > Security > reCAPTCHA (enable the reCAPTCHA Enterprise API if asked): create a **website** key for the hosting domains, `vs-valiance-studios-dev-whiteboard.web.app` and `vs-valiance-studios-dev-whiteboard.firebaseapp.com`, plus any custom domain. Do not enable a challenge; App Check uses score-based keys.
2. Firebase console > App Check > Apps: register the web app with the **reCAPTCHA Enterprise** provider and that site key.
3. Put the key in the mode's env file (`.env.staging` for the dev project) as `VITE_APPCHECK_SITE_KEY` and deploy.
4. **Enforce** for Cloud Firestore and Authentication (done for the dev project). Before enforcing a service that is not enforced yet, confirm that every app in the project using it sends App Check tokens: App Check > APIs shows verified and unverified requests, and unverified ones come from old cached builds, scripts, or a misconfigured domain. If an app breaks, unenforce in the console; it takes effect within minutes and needs no deploy, but it removes the protection for every app in the project.

Enforcement is a per-service switch for the whole project, not per app, so a project cannot enforce App Check for some registered apps while only monitoring others. A new app in `vs-valiance-studios-dev`, or in any project where a service is already enforced, therefore has no monitoring period: that service rejects the app's requests unless it sends valid tokens from its first deploy. Monitoring an app on its own would take a separate Firebase/GCP project for it, which is not needed for now.

### Debug Token

For `npm run dev:staging`. `localhost` is deliberately not a reCAPTCHA domain, so local runs against the dev project use a debug token instead.

1. Generate one, e.g. `node -e "console.log(crypto.randomUUID())"`.
2. Register it in Firebase console > App Check > Apps > (web app) > Manage debug tokens.
3. Put `VITE_APPCHECK_DEBUG_TOKEN=<token>` in a gitignored `.env.staging.local`.

`activateAppCheck` sets it as `self.FIREBASE_APPCHECK_DEBUG_TOKEN` before starting App Check. A registered debug token passes App Check, so the deploy check refuses any build that has one; revoke it in the console if it leaks.
