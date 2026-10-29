import type {User} from 'firebase/auth';

import {doc, getDoc, serverTimestamp, setDoc} from 'firebase/firestore';
import {db} from './index';

/** Keyed by lowercase email; managed in the Firebase console. Mirrors `isAllowed` in `firestore.rules`. */
const ALLOWED_USERS_COLLECTION = 'allowedUsers';

/** Denied sign-ins, keyed by uid, for the owner to review in the console. Mirrors `accessRequests` in `firestore.rules`. */
const ACCESS_REQUESTS_COLLECTION = 'accessRequests';

/** Whether the security rules will let this user use Firestore: a verified email that is on the allowlist. */
export async function hasFirestoreAccess(user: User): Promise<boolean> {
  if (!user.email || !user.emailVerified) {
    return false;
  }

  const snapshot = await getDoc(doc(db, ALLOWED_USERS_COLLECTION, user.email.toLowerCase()));

  return snapshot.exists();
}

/**
 * Records that this user signed in without access, so the owner can find them and add them to the
 * allowlist. Each user has one request, overwritten with the latest attempt; the rules accept at most
 * one update a minute, so a quick retry fails here even though its request is already on record.
 */
export async function recordAccessRequest(user: User): Promise<void> {
  if (!user.email) {
    throw new Error('Only a signed-in user with an email can request access.');
  }

  await setDoc(doc(db, ACCESS_REQUESTS_COLLECTION, user.uid), {
    email: user.email,
    displayName: user.displayName,
    requestedAt: serverTimestamp(),
  });
}
