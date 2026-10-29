import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import {FirebaseError} from 'firebase/app';
import {signInWithPopup, signOut} from 'firebase/auth';
import {hasFirestoreAccess} from '@/firebase/access';
import {useAuthStore} from '@/stores/auth';

vi.mock('@/firebase', () => ({auth: {}}));
vi.mock('@/firebase/access', () => ({hasFirestoreAccess: vi.fn()}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

const ADA = {uid: 'u1', displayName: 'Ada', email: 'ada@example.com', photoURL: null};

describe('auth store: signInWithGoogle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(signInWithPopup).mockResolvedValue({user: ADA} as Awaited<ReturnType<typeof signInWithPopup>>);
    vi.mocked(hasFirestoreAccess).mockResolvedValue(true);
  });

  it('stores the signed-in user and reports success', async () => {
    const store = useAuthStore();

    await expect(store.signInWithGoogle()).resolves.toBe(true);
    expect(store.user).toEqual(ADA);
    expect(store.deniedUser).toBeNull();
  });

  it('signs out a user without access and remembers who it was', async () => {
    vi.mocked(hasFirestoreAccess).mockResolvedValue(false);
    const store = useAuthStore();

    await expect(store.signInWithGoogle()).resolves.toBe(false);
    expect(store.user).toBeNull();
    expect(store.deniedUser).toEqual(ADA);
    expect(signOut).toHaveBeenCalled();
  });

  it('clears the denied user when signing in again', async () => {
    vi.mocked(hasFirestoreAccess).mockResolvedValueOnce(false);
    const store = useAuthStore();
    await store.signInWithGoogle();

    await expect(store.signInWithGoogle()).resolves.toBe(true);
    expect(store.deniedUser).toBeNull();
    expect(hasFirestoreAccess).toHaveBeenCalledTimes(2);
  });

  it('checks access once when the auth state listener reports the same user', async () => {
    const store = useAuthStore();

    await Promise.all([store.signInWithGoogle(), store.startSession(ADA as Parameters<typeof store.startSession>[0])]);

    expect(hasFirestoreAccess).toHaveBeenCalledTimes(1);
  });

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])('reports %s as a cancellation, not an error', async (code) => {
    vi.mocked(signInWithPopup).mockRejectedValue(new FirebaseError(code, 'cancelled'));
    const store = useAuthStore();

    await expect(store.signInWithGoogle()).resolves.toBe(false);
    expect(store.user).toBeNull();
  });

  it('rethrows other sign-in failures', async () => {
    vi.mocked(signInWithPopup).mockRejectedValue(new FirebaseError('auth/network-request-failed', 'offline'));

    await expect(useAuthStore().signInWithGoogle()).rejects.toThrow('offline');
  });
});
