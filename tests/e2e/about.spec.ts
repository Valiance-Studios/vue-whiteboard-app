import type {Page} from '@playwright/test';

import {expect, test} from '@playwright/test';

function aboutButton(page: Page) {
  return page.getByRole('button', {name: 'About this app'});
}

test('explains the app from the login page, with a link to its code', async ({page}) => {
  await page.goto('/login');

  await aboutButton(page).click();
  const dialog = page.getByRole('dialog');

  await expect(dialog.getByText('About Whiteboard')).toBeVisible();
  await expect(dialog.getByText('Vue 3', {exact: true})).toBeVisible();

  const codeLink = dialog.getByRole('link', {name: 'View the code'});

  await expect(codeLink).toHaveAttribute('href', 'https://github.com/Valiance-Studios/vue-whiteboard-app');
  await expect(codeLink).toHaveAttribute('target', '_blank');

  await dialog.getByRole('button', {name: 'Close'}).click();

  await expect(dialog).toHaveCount(0);
});

test('is in the app bar once signed in, and closes with Escape', async ({page}) => {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/boards$/);

  await aboutButton(page).click();
  await expect(page.getByRole('dialog').getByText('About Whiteboard')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).toHaveCount(0);
});
