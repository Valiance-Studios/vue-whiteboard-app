import {expect, test} from '@playwright/test';

test('unauthenticated visit to a board redirects to login', async ({page}) => {
  await page.goto('/boards/some-board');

  await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('redirect') === '/boards/some-board');
  await expect(page.getByRole('button', {name: 'Sign in with Google'})).toBeVisible();
});

test('closing the sign-in popup leaves the login page ready without an error', async ({page}) => {
  await page.goto('/login');
  const signInButton = page.getByRole('button', {name: 'Sign in with Google'});

  const popupPromise = page.waitForEvent('popup');
  await signInButton.click();
  const popup = await popupPromise;
  await popup.waitForLoadState('load');
  await popup.close();

  await expect(signInButton).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page).toHaveURL(/\/login$/);
});
