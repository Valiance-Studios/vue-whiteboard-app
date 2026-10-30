import {expect, test} from '@playwright/test';
import {PLACEHOLDER_PHOTO_URL} from '../../scripts/emulator-admin.ts';
import {createTestUser, signIn} from './support/auth';

test('the avatar shows the account\'s photo', async ({page}) => {
  await signIn(page, {...createTestUser('Photo'), photoUrl: PLACEHOLDER_PHOTO_URL});

  const photo = page.locator('.v-app-bar .v-avatar img');
  await expect(photo).toHaveAttribute('src', PLACEHOLDER_PHOTO_URL);
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test('the avatar shows the initial for an account without a photo', async ({page}) => {
  await signIn(page, createTestUser('Initial'));

  const avatar = page.locator('.v-app-bar .v-avatar');
  await expect(avatar).toHaveText('I');
  await expect(avatar.locator('img')).toHaveCount(0);
});
