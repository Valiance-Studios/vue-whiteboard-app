import type {RouteLocationNormalized} from 'vue-router';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import {sessionGuard} from '@/router/guards';
import {RouteName} from '@/router/routes';
import {useAuthStore} from '@/stores/auth';

vi.mock('@/firebase', () => ({auth: {}}));

function routeTo(fullPath: string, meta: RouteLocationNormalized['meta']): RouteLocationNormalized {
  return {fullPath, meta} as RouteLocationNormalized;
}

describe('sessionGuard', () => {
  let authStore: ReturnType<typeof useAuthStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    authStore = useAuthStore();
    vi.spyOn(authStore, 'init').mockResolvedValue();
  });

  it('redirects unauthenticated users to login, preserving the requested path', async () => {
    const result = await sessionGuard(routeTo('/boards/abc', {requiresAuth: true}));

    expect(result).toEqual({name: RouteName.Login, query: {redirect: '/boards/abc'}});
  });

  it('allows authenticated users onto protected routes', async () => {
    authStore.user = {uid: 'u1', kind: 'google', displayName: 'Test', email: null, photoURL: null};

    expect(await sessionGuard(routeTo('/boards', {requiresAuth: true}))).toBe(true);
  });

  it('sends authenticated users away from guest-only routes', async () => {
    authStore.user = {uid: 'u1', kind: 'google', displayName: 'Test', email: null, photoURL: null};

    expect(await sessionGuard(routeTo('/login', {guestOnly: true}))).toEqual({name: RouteName.BoardCollection});
  });

  it('allows unauthenticated users onto guest-only routes', async () => {
    expect(await sessionGuard(routeTo('/login', {guestOnly: true}))).toBe(true);
  });

  it('waits for auth initialization before deciding', async () => {
    await sessionGuard(routeTo('/boards', {requiresAuth: true}));

    expect(authStore.init).toHaveBeenCalledOnce();
  });
});
