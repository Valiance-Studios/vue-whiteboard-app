import type {Page} from '@playwright/test';

import {expect, test} from '@playwright/test';

function app(page: Page) {
  return page.locator('.v-application');
}

test('follows the system setting until a theme is picked', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'});
  await page.goto('/login');

  await expect(app(page)).toHaveClass(/v-theme--dark/);

  await page.emulateMedia({colorScheme: 'light'});

  await expect(app(page)).toHaveClass(/v-theme--light/);
});

test('switches theme from the app bar and remembers the choice', async ({page}) => {
  await page.emulateMedia({colorScheme: 'light'});
  await page.goto('/login');
  await expect(app(page)).toHaveClass(/v-theme--light/);

  await page.getByRole('button', {name: 'Switch to dark mode'}).click();

  await expect(app(page)).toHaveClass(/v-theme--dark/);
  await expect(page.getByRole('button', {name: 'Switch to light mode'})).toBeVisible();

  // The choice outlasts a reload, and overrides the system setting.
  await page.reload();

  await expect(app(page)).toHaveClass(/v-theme--dark/);

  await page.getByRole('button', {name: 'Switch to light mode'}).click();
  await page.emulateMedia({colorScheme: 'dark'});
  await page.reload();

  await expect(app(page)).toHaveClass(/v-theme--light/);
});
