/**
 * Fails a deploy whose production build would have no Firebase config.
 *
 * Usage: node scripts/check-firebase-config.ts
 *
 * Without this the build still succeeds, Hosting serves it, and the app only reports the problem
 * in the browser as an opaque Firebase error. It runs from `hosting.predeploy` in firebase.json,
 * so it covers every deploy regardless of which npm script started it. `npm run build` stays
 * usable without credentials, since it is also the project's type and bundle check.
 */
import {loadEnv} from 'vite';

// Reads .env, .env.production and .env.production.local, plus any VITE_ variables in the shell.
const env = loadEnv('production', process.cwd(), 'VITE_');
const missing = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'].filter((key) => !env[key]);

if (env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  console.error('Refusing to deploy a build pointed at the Firebase emulators (VITE_USE_FIREBASE_EMULATORS=true).');
  process.exit(1);
}

if (missing.length > 0) {
  console.error(`Firebase config is missing: ${missing.join(', ')}.`);
  console.error('Copy .env.example to .env.production.local and fill it in from the Firebase console.');
  process.exit(1);
}

console.log(`Deploying with Firebase project "${env.VITE_FIREBASE_PROJECT_ID}", database "${env.VITE_FIREBASE_DATABASE_ID || '(default)'}".`);
