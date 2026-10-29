import {expect, test} from '@playwright/test';
import {listDocuments} from '../../scripts/emulator-admin.ts';
import {allowUser, createTestUser, submitSignIn} from './support/auth';

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

test('an account that is not on the allowlist is signed out and told why', async ({page}) => {
  const user = createTestUser();

  await submitSignIn(page, user);

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(`${user.email} does not have access to this app.`)).toBeVisible();
  await expect(page.getByText('Your request has been recorded for the app\'s owner.')).toBeVisible();

  // The request is on record for the owner, with the account's details.
  const requests = await listDocuments('accessRequests');
  expect(requests.find((fields) => fields.email?.stringValue === user.email)).toMatchObject({
    displayName: {stringValue: user.displayName},
    requestedAt: {timestampValue: expect.any(String) as unknown},
  });

  // Once an admin adds them, the same account can sign in.
  await allowUser(user);
  await submitSignIn(page, user);

  await expect(page).toHaveURL(/\/boards$/);
});
