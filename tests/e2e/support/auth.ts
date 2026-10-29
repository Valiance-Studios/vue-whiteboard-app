import type {Page} from '@playwright/test';

import {expect} from '@playwright/test';
import {allowEmail} from '../../../scripts/emulator-admin.ts';

export interface TestUser {
  email: string;
  displayName: string;
}

const POPUP_CLOSE_TIMEOUT_MS = 5_000;

/** A user unique to this call, so tests never see each other's boards. */
export function createTestUser(name = 'Test User'): TestUser {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {email: `user-${id}@example.com`, displayName: `${name} ${id}`};
}

/** Adds the user to the allowlist the security rules check, as an admin would in the Firebase console. */
export async function allowUser(user: TestUser): Promise<void> {
  await allowEmail(user.email);
}

/** One pass through the Auth emulator's Google popup. Throws if the popup does not complete. */
async function attemptPopupSignIn(page: Page, user: TestUser): Promise<void> {
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', {name: 'Sign in with Google'}).click();
  const popup = await popupPromise;
  // Clicks before the emulator's script has loaded are silently ignored.
  await popup.waitForLoadState('load');

  await popup.getByRole('button', {name: 'Add new account'}).click();
  // The emulator's inputs have no accessible names (broken aria-labelledby), so select by id.
  await popup.locator('#email-input').fill(user.email);
  await popup.locator('#display-name-input').fill(user.displayName);

  const closed = popup.waitForEvent('close', {timeout: POPUP_CLOSE_TIMEOUT_MS});
  await popup.getByRole('button', {name: 'Sign in with Google.com'}).click();

  try {
    await closed;
  } catch (error) {
    // Closing the popup makes the app's sign-in fail cleanly, so the attempt can be retried.
    await popup.close();
    throw error;
  }
}

/**
 * Goes through the Auth emulator's Google sign-in popup from the login page, whether or not the user has access.
 * On a freshly started Auth emulator, a popup occasionally ignores the submit entirely
 * (no request is sent and it never closes), so stuck attempts are retried with a new popup.
 */
export async function submitSignIn(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');

  await expect(async () => {
    await attemptPopupSignIn(page, user);
  }).toPass({timeout: 30_000});
}

/** Signs in as an allowlisted user and waits for the board collection. */
export async function signIn(page: Page, user: TestUser = createTestUser()): Promise<TestUser> {
  await allowUser(user);
  await submitSignIn(page, user);

  await expect(page).toHaveURL(/\/boards$/);

  return user;
}
