import type {SessionUser} from '@/types/session';
import type {User} from 'firebase/auth';

import {defineStore} from 'pinia';
import {auth} from '@/firebase';
import {FirebaseError} from 'firebase/app';
import {GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as signOutFirebase} from 'firebase/auth';

interface AuthState {
  user: SessionUser | null;
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

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
  }),

  getters: {
    isAuthenticated: (state): boolean => state.user !== null,
  },

  actions: {
    /** Subscribes to auth state once; resolves after Firebase reports the initial state. Safe to call repeatedly. */
    init(): Promise<void> {
      initPromise ??= new Promise<void>((resolve) => {
        onAuthStateChanged(auth, (user) => {
          this.user = user ? toSessionUser(user) : null;
          resolve();
        });
      });
      return initPromise;
    },

    /** Returns `false` if the user closed the popup without signing in; throws on actual failures. */
    async signInWithGoogle(): Promise<boolean> {
      try {
        const credential = await signInWithPopup(auth, new GoogleAuthProvider());
        this.user = toSessionUser(credential.user);

        return true;
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
  },
});
