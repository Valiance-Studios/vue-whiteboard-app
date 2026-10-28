import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import {FirebaseError} from 'firebase/app';
import {signInWithPopup} from 'firebase/auth';
import {useAuthStore} from '@/stores/auth';

vi.mock('@/firebase', () => ({auth: {}}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

describe('auth store: signInWithGoogle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('stores the signed-in user and reports success', async () => {
    vi.mocked(signInWithPopup).mockResolvedValue({
      user: {uid: 'u1', displayName: 'Ada', email: 'ada@example.com', photoURL: null},
    } as Awaited<ReturnType<typeof signInWithPopup>>);
    const store = useAuthStore();

    await expect(store.signInWithGoogle()).resolves.toBe(true);
    expect(store.user).toEqual({uid: 'u1', displayName: 'Ada', email: 'ada@example.com', photoURL: null});
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
