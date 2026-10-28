import type {RouteRecordRaw} from 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    /** Route requires a session; unauthenticated users are sent to the login view. */
    requiresAuth?: boolean;
    /** Route is only for users without a session (e.g. login); authenticated users are sent to the boards view. */
    guestOnly?: boolean;
  }
}

export enum RouteName {
  Login = 'login',
  BoardCollection = 'board-collection',
  Board = 'board',
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: {name: RouteName.BoardCollection},
  },
  {
    path: '/login',
    name: RouteName.Login,
    component: () => import('@/views/LoginView.vue'),
    meta: {guestOnly: true},
  },
  {
    path: '/boards',
    name: RouteName.BoardCollection,
    component: () => import('@/views/BoardCollectionView.vue'),
    meta: {requiresAuth: true},
  },
  {
    path: '/boards/:id',
    name: RouteName.Board,
    component: () => import('@/views/BoardView.vue'),
    props: true,
    meta: {requiresAuth: true},
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: {name: RouteName.BoardCollection},
  },
];
