/** Where a session's boards live: Firestore for Google accounts, this browser for demo mode. */
export type SessionKind = 'google' | 'demo';

/** The signed-in user, decoupled from the Firebase `User` object so other session sources (e.g. demo mode) can supply one. */
export interface SessionUser {
  uid: string;
  kind: SessionKind;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
