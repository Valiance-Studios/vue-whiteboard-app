/** The signed-in user, decoupled from the Firebase `User` object so other session sources (e.g. demo mode) can supply one. */
export interface SessionUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
