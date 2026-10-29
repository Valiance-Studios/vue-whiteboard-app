import {initializeApp} from 'firebase/app';
import {initializeAppCheck, ReCaptchaEnterpriseProvider} from 'firebase/app-check';
import {connectAuthEmulator, getAuth} from 'firebase/auth';
import {connectFirestoreEmulator, getFirestore} from 'firebase/firestore';
import {appCheckSiteKey, emulatorHosts, firebaseOptions, firestoreDatabaseId, useEmulators} from './config';

export const firebaseApp = initializeApp(firebaseOptions);

// App Check attests that requests come from this web app, so Firestore can reject scripts that only have
// the config. It must start before any Firestore call. The emulators do not check it, so it stays off there.
if (!useEmulators && appCheckSiteKey) {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(firebaseApp);
export const db = firestoreDatabaseId ? getFirestore(firebaseApp, firestoreDatabaseId) : getFirestore(firebaseApp);

if (useEmulators) {
  connectAuthEmulator(auth, emulatorHosts.auth, {disableWarnings: true});
  connectFirestoreEmulator(db, emulatorHosts.firestore.host, emulatorHosts.firestore.port);
}
