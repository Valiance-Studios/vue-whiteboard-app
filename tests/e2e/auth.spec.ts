import {expect, test} from '@playwright/test';

test('unauthenticated visit to a board redirects to login', async ({page}) => {
  await page.goto('/boards/some-board');

  await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('redirect') === '/boards/some-board');
  await expect(page.getByRole('button', {name: 'Sign in with Google'})).toBeVisible();
});
