import type {SessionUser} from '@/types/session';
import type {User} from 'firebase/auth';

import {defineStore} from 'pinia';
import {auth} from '@/firebase';
import {GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as signOutFirebase} from 'firebase/auth';

interface AuthState {
  user: SessionUser | null;
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

    async signInWithGoogle(): Promise<void> {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      this.user = toSessionUser(credential.user);
    },

    async signOut(): Promise<void> {
      await signOutFirebase(auth);
      this.user = null;
    },
  },
});
