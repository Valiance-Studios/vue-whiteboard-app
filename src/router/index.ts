import {createRouter, createWebHistory} from 'vue-router';
import {routes} from './routes';
import {sessionGuard} from './guards';

export {RouteName} from './routes';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(sessionGuard);

export default router;
