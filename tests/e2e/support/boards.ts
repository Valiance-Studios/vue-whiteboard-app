import type {Locator, Page} from '@playwright/test';

import {expect} from '@playwright/test';

/** Creates a board from the collection page and leaves the browser on the new board. Returns its URL. */
export async function createBoard(page: Page, title: string): Promise<string> {
  await page.getByRole('button', {name: 'New board'}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill(title);
  await dialog.getByRole('button', {name: 'Create'}).click();

  await expect(page).toHaveURL(/\/boards\/[^/]+$/);
  await expect(page.getByRole('heading', {name: title})).toBeVisible();

  return page.url();
}

/** The board's writing area. */
export function boardText(page: Page): Locator {
  return page.getByRole('textbox', {name: 'Board content'});
}

/** The save status shown next to the board's title. */
export function saveStatus(page: Page): Locator {
  return page.getByRole('status');
}
