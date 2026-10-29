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

/** The strokes sketched on the board. */
export function strokes(page: Page): Locator {
  return page.locator('.sketch-layer__stroke');
}

/** A button on the marker tray, e.g. "Sketch" or "Eraser". Scoped to the tray, so a board's title cannot match. */
export function trayButton(page: Page, name: string): Locator {
  return page.locator('.marker-tray').getByRole('button', {name, exact: true});
}

/** Switches the board between typing and sketching. */
export async function setBoardMode(page: Page, mode: 'Text' | 'Sketch'): Promise<void> {
  await trayButton(page, mode).click();
}

/**
 * Drags the mouse across the board, from and to points given as fractions of the board's width and height,
 * as the pen or the eraser would.
 */
export async function dragOnBoard(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const surface = page.locator('.whiteboard-sheet__surface');
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();

  if (!box) {
    throw new Error('The board is not on screen.');
  }

  const at = ([x, y]: [number, number]): [number, number] => [box.x + box.width * x, box.y + box.height * y];
  const [startX, startY] = at(from);
  const [endX, endY] = at(to);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, {steps: 12});
  await page.mouse.up();
}
