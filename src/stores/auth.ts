import type {SessionUser} from '@/types/session';
import type {User} from 'firebase/auth';

import {defineStore} from 'pinia';
import {auth} from '@/firebase';
import {hasFirestoreAccess} from '@/firebase/access';
import {FirebaseError} from 'firebase/app';
import {GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as signOutFirebase} from 'firebase/auth';

interface AuthState {
  user: SessionUser | null;
  /** The last account that signed in without access, so the login page can say why it did not work. */
  deniedUser: SessionUser | null;
}

/** Error codes meaning the user dismissed sign-in rather than it failing. */
const CANCELLED_SIGN_IN_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

function isCancelledSignIn(error: unknown): boolean {
  return error instanceof FirebaseError && CANCELLED_SIGN_IN_CODES.has(error.code);
}

function toSessionUser(user: User): SessionUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

let initPromise: Promise<void> | null = null;

/**
 * The access check for the current Firebase user. A sign-in reports the user both to
 * `signInWithGoogle` and to the auth state listener, so the check is shared rather than read twice.
 */
let accessCheck: {uid: string; allowed: Promise<boolean>} | null = null;

function checkAccess(user: User): Promise<boolean> {
  if (accessCheck?.uid !== user.uid) {
    accessCheck = {uid: user.uid, allowed: hasFirestoreAccess(user)};
  }

  return accessCheck.allowed;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    deniedUser: null,
  }),

  getters: {
    isAuthenticated: (state): boolean => state.user !== null,
  },

  actions: {
    /** Subscribes to auth state once; resolves after Firebase reports the initial state. Safe to call repeatedly. */
    init(): Promise<void> {
      initPromise ??= new Promise<void>((resolve) => {
        onAuthStateChanged(auth, (user) => {
          this.startSession(user)
            .catch((error: unknown) => {
              // Without a completed access check there is no session; signing in again retries it.
              console.error('Failed to check access', error);
              this.user = null;
            })
            .finally(resolve);
        });
      });

      return initPromise;
    },

    /**
     * Returns `false` if the user closed the popup without signing in, or if their account has no
     * access (see `deniedUser`); throws on actual failures.
     */
    async signInWithGoogle(): Promise<boolean> {
      this.deniedUser = null;
      // Check afresh, in case the last check failed or the user has since been added to the allowlist.
      accessCheck = null;

      try {
        const credential = await signInWithPopup(auth, new GoogleAuthProvider());

        return await this.startSession(credential.user);
      } catch (error) {
        if (isCancelledSignIn(error)) {
          return false;
        }

        throw error;
      }
    },

    async signOut(): Promise<void> {
      await signOutFirebase(auth);
      this.user = null;
    },

    /** Starts a session for a Firebase user, signing out one without access. Returns whether a session started. */
    async startSession(user: User | null): Promise<boolean> {
      if (user === null) {
        accessCheck = null;
        this.user = null;

        return false;
      }

      if (!(await checkAccess(user))) {
        this.deniedUser = toSessionUser(user);
        await this.signOut();

        return false;
      }

      this.user = toSessionUser(user);

      return true;
    },
  },
});
