import type {User} from 'firebase/auth';

import {doc, getDoc} from 'firebase/firestore';
import {db} from './index';

/** Keyed by lowercase email; managed in the Firebase console. Mirrors `isAllowed` in `firestore.rules`. */
const ALLOWED_USERS_COLLECTION = 'allowedUsers';

/** Whether the security rules will let this user use Firestore: a verified email that is on the allowlist. */
export async function hasFirestoreAccess(user: User): Promise<boolean> {
  if (!user.email || !user.emailVerified) {
    return false;
  }

  const snapshot = await getDoc(doc(db, ALLOWED_USERS_COLLECTION, user.email.toLowerCase()));

  return snapshot.exists();
}
