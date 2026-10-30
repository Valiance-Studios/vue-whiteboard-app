import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import {FirebaseError} from 'firebase/app';
import {onAuthStateChanged, signInWithPopup, signOut} from 'firebase/auth';
import {hasFirestoreAccess, recordAccessRequest} from '@/firebase/access';
import {useAuthStore} from '@/stores/auth';

vi.mock('@/firebase', () => ({auth: {}}));
vi.mock('@/firebase/access', () => ({hasFirestoreAccess: vi.fn(), recordAccessRequest: vi.fn()}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

const ADA = {uid: 'u1', displayName: 'Ada', email: 'ada@example.com', photoURL: null};
const ADA_SESSION = {...ADA, kind: 'google'};
const DEMO_PROFILE_KEY = 'whiteboard.demo.profile';

describe('auth store: signInWithGoogle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(signInWithPopup).mockResolvedValue({user: ADA} as Awaited<ReturnType<typeof signInWithPopup>>);
    vi.mocked(hasFirestoreAccess).mockResolvedValue(true);
    vi.mocked(recordAccessRequest).mockResolvedValue();
  });

  it('stores the signed-in user and reports success', async () => {
    const store = useAuthStore();

    await expect(store.signInWithGoogle()).resolves.toBe(true);
    expect(store.user).toEqual(ADA_SESSION);
    expect(store.deniedUser).toBeNull();
  });

  it('signs out a user without access and remembers who it was', async () => {
    vi.mocked(hasFirestoreAccess).mockResolvedValue(false);
    const store = useAuthStore();

    await expect(store.signInWithGoogle()).resolves.toBe(false);
    expect(store.user).toBeNull();
    expect(store.deniedUser).toEqual(ADA_SESSION);
    expect(signOut).toHaveBeenCalled();
  });

  it('records a denied sign-in once, though the auth state listener reports it too', async () => {
    vi.mocked(hasFirestoreAccess).mockResolvedValue(false);
    const store = useAuthStore();

    await Promise.all([store.signInWithGoogle(), store.startSession(ADA as Parameters<typeof store.startSession>[0])]);

    expect(recordAccessRequest).toHaveBeenCalledTimes(1);
    expect(recordAccessRequest).toHaveBeenCalledWith(ADA);
    expect(store.accessRequested).toBe(true);
  });

  it('still denies access, without claiming a request, when recording it fails', async () => {
    vi.mocked(hasFirestoreAccess).mockResolvedValue(false);
    vi.mocked(recordAccessRequest).mockRejectedValue(new Error('permission-denied'));
    const store = useAuthStore();

    await expect(store.signInWithGoogle()).resolves.toBe(false);

    expect(store.user).toBeNull();
    expect(store.deniedUser).toEqual(ADA_SESSION);
    expect(store.accessRequested).toBe(false);
    expect(signOut).toHaveBeenCalled();
  });

  it('does not record a request for an allowed user', async () => {
    await useAuthStore().signInWithGoogle();

    expect(recordAccessRequest).not.toHaveBeenCalled();
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

describe('auth store: demo mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('starts a demo session under the given name and remembers it', () => {
    const store = useAuthStore();

    expect(store.enterDemo('  Grace  ')).toBe(true);
    expect(store.user).toEqual({uid: 'demo', kind: 'demo', displayName: 'Grace', email: null, photoURL: null});
    expect(store.isDemo).toBe(true);
    expect(JSON.parse(localStorage.getItem(DEMO_PROFILE_KEY) ?? 'null')).toEqual({displayName: 'Grace', active: true});
  });

  it('asks for a name on a first visit', () => {
    const store = useAuthStore();

    expect(store.enterDemo()).toBe(false);
    expect(store.enterDemo('   ')).toBe(false);
    expect(store.user).toBeNull();
  });

  it('lets a returning visitor straight back in under their saved name', async () => {
    const store = useAuthStore();
    store.enterDemo('Grace');
    await store.signOut();

    expect(store.user).toBeNull();
    expect(store.enterDemo()).toBe(true);
    expect(store.user?.displayName).toBe('Grace');
  });

  it('keeps the name but ends the session when signing out, without touching Firebase', async () => {
    const store = useAuthStore();
    store.enterDemo('Grace');

    await store.signOut();

    expect(signOut).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(DEMO_PROFILE_KEY) ?? 'null')).toEqual({displayName: 'Grace', active: false});
  });

  it('is not ended by Firebase reporting no user', async () => {
    const store = useAuthStore();
    store.enterDemo('Grace');

    await store.startSession(null);

    expect(store.user?.kind).toBe('demo');
  });

  it('enters as a guest from the demo link on a first visit, without asking for a name', () => {
    const store = useAuthStore();

    store.enterDemoAsGuest();

    expect(store.user).toMatchObject({kind: 'demo', displayName: 'Guest'});
  });

  it('enters under the saved name from the demo link on a return visit', async () => {
    const store = useAuthStore();
    store.enterDemo('Grace');
    await store.signOut();

    store.enterDemoAsGuest();

    expect(store.user?.displayName).toBe('Grace');
  });

  it('greets a returning visitor by their saved name', async () => {
    const store = useAuthStore();
    expect(store.savedDemoName()).toBeNull();

    store.enterDemo('Grace');
    await store.signOut();

    expect(store.savedDemoName()).toBe('Grace');
  });

  it('starts someone new, deleting the previous visitor\'s demo boards', async () => {
    const store = useAuthStore();
    store.enterDemo('Grace');
    localStorage.setItem('whiteboard.demo.boards', JSON.stringify([{id: 'b1'}]));
    await store.signOut();

    expect(store.enterDemoAsSomeoneNew('Alan')).toBe(true);

    expect(store.user?.displayName).toBe('Alan');
    expect(localStorage.getItem('whiteboard.demo.boards')).toBeNull();
    expect(store.savedDemoName()).toBe('Alan');
  });

  it('keeps the previous visitor\'s boards when someone new gives no name', () => {
    localStorage.setItem('whiteboard.demo.boards', '[]');

    expect(useAuthStore().enterDemoAsSomeoneNew('  ')).toBe(false);
    expect(localStorage.getItem('whiteboard.demo.boards')).toBe('[]');
  });

  it('ignores an unreadable saved profile', () => {
    localStorage.setItem(DEMO_PROFILE_KEY, '{not json');

    expect(useAuthStore().enterDemo()).toBe(false);
  });

  it('resumes a demo session left active when the app starts', async () => {
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify({displayName: 'Grace', active: true}));
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, listener) => {
      (listener as (user: null) => void)(null);

      return () => {};
    });
    // A fresh module, since `init` subscribes only once per module.
    vi.resetModules();
    const {useAuthStore: useFreshAuthStore} = await import('@/stores/auth');
    const store = useFreshAuthStore();

    await store.init();

    expect(store.user).toEqual({uid: 'demo', kind: 'demo', displayName: 'Grace', email: null, photoURL: null});
  });
});
