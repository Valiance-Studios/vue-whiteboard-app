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

/** The lines written on the board, one paragraph each. */
export function boardLines(page: Page): Locator {
  return boardText(page).locator('p');
}

/** The text on the board written in one marker's ink. */
export function inkedText(page: Page, ink: string): Locator {
  return boardText(page).locator(`[data-ink="${ink}"]`);
}

/** The tray button for a marker, by its name, e.g. "Red". */
export function marker(page: Page, name: string): Locator {
  return page.getByRole('button', {name: `${name} marker`});
}

/** Replaces everything on the board with `text`, typing each line as the user would. */
export async function writeOnBoard(page: Page, text: string): Promise<void> {
  await boardText(page).click();
  await page.keyboard.press('ControlOrMeta+A');

  for (const [index, line] of text.split('\n').entries()) {
    if (index > 0) {
      await page.keyboard.press('Enter');
    }

    await page.keyboard.insertText(line);
  }
}

/** The save status shown next to the board's title. */
export function saveStatus(page: Page): Locator {
  return page.getByRole('status');
}
