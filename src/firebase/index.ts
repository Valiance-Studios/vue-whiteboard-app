import {initializeApp} from 'firebase/app';
import {connectAuthEmulator, getAuth} from 'firebase/auth';
import {connectFirestoreEmulator, getFirestore} from 'firebase/firestore';
import {emulatorHosts, firebaseOptions, useEmulators} from './config';

export const firebaseApp = initializeApp(firebaseOptions);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

if (useEmulators) {
  connectAuthEmulator(auth, emulatorHosts.auth, {disableWarnings: true});
  connectFirestoreEmulator(db, emulatorHosts.firestore.host, emulatorHosts.firestore.port);
}
