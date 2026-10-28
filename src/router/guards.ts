import type {RouteLocationNormalized, RouteLocationRaw} from 'vue-router';
import {useAuthStore} from '@/stores/auth';
import {RouteName} from './routes';

/** Enforces `meta.requiresAuth` and `meta.guestOnly`, preserving the requested path for post-login redirect. */
export async function sessionGuard(to: RouteLocationNormalized): Promise<RouteLocationRaw | true> {
  const authStore = useAuthStore();
  await authStore.init();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {name: RouteName.Login, query: {redirect: to.fullPath}};
  }
  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return {name: RouteName.BoardCollection};
  }
  return true;
}
