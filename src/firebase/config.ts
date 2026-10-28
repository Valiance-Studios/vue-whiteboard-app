import type {FirebaseOptions} from 'firebase/app';

const env = import.meta.env;

export const firebaseOptions: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const useEmulators: boolean = env.VITE_USE_FIREBASE_EMULATORS === 'true';

export const emulatorHosts = {
  auth: 'http://127.0.0.1:9099',
  firestore: {host: '127.0.0.1', port: 8080},
} as const;
