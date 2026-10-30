import type {Locator} from '@playwright/test';

import {expect, test} from '@playwright/test';
import {signIn} from './support/auth';
import {boardLines, boardText, createBoard, inkedText, marker, saveStatus, writeOnBoard} from './support/boards';

type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

/** Where an element is on the page; it must be visible. */
async function boundingBox(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error('Expected the element to be visible');
  }

  return box;
}

test.describe('board editing', () => {
  test.beforeEach(async ({page}) => {
    await signIn(page);
  });

  test('saves writing after a pause and keeps it after a reload', async ({page}) => {
    await createBoard(page, 'Shopping List');

    await expect(saveStatus(page)).toBeHidden();

    await writeOnBoard(page, 'Milk\nEggs');

    await expect(saveStatus(page)).toContainText('All changes saved');

    await page.reload();

    await expect(boardLines(page)).toHaveText(['Milk', 'Eggs']);
  });

  test('saves the latest writing when several edits follow each other', async ({page}) => {
    const boardUrl = await createBoard(page, 'Running Notes');
    await writeOnBoard(page, 'first');
    await writeOnBoard(page, 'second');
    await writeOnBoard(page, 'third');

    await expect(saveStatus(page)).toContainText('All changes saved');

    await page.goto(boardUrl);

    await expect(boardText(page)).toHaveText('third');
  });

  test('saves pending writing when leaving the board before the pause', async ({page}) => {
    const boardUrl = await createBoard(page, 'Quick Note');

    // No wait here: the edit is still pending when the navigation starts.
    await writeOnBoard(page, 'Written on the way out');
    await page.goBack();
    await expect(page).toHaveURL(/\/boards$/);

    await page.goto(boardUrl);

    await expect(boardText(page)).toHaveText('Written on the way out');
  });

  test('shows saved writing in the board collection', async ({page}) => {
    await createBoard(page, 'Preview Board');
    await writeOnBoard(page, 'A line worth previewing');
    await expect(saveStatus(page)).toContainText('All changes saved');

    await page.goBack();

    await expect(page.locator('.board-card').first()).toContainText('A line worth previewing');
  });

  test('writes in the marker in hand and keeps the colors after a reload', async ({page}) => {
    await createBoard(page, 'Colors');

    await expect(marker(page, 'Blue')).toHaveAttribute('aria-pressed', 'true');

    await writeOnBoard(page, 'Hello ');
    await marker(page, 'Red').click();

    await expect(marker(page, 'Red')).toHaveAttribute('aria-pressed', 'true');
    await expect(marker(page, 'Blue')).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.insertText('world');
    await expect(saveStatus(page)).toContainText('All changes saved');

    // Checked before the reload too, so the board shows what it saves.
    await expect(inkedText(page, 'blue')).toHaveText('Hello ');
    await expect(inkedText(page, 'red')).toHaveText('world');

    await page.reload();

    await expect(inkedText(page, 'blue')).toHaveText('Hello ');
    await expect(inkedText(page, 'red')).toHaveText('world');
  });

  test('recolors the selected writing', async ({page}) => {
    await createBoard(page, 'Recolor');
    await writeOnBoard(page, 'Milk\nEggs');
    await expect(saveStatus(page)).toContainText('All changes saved');

    await page.keyboard.press('ControlOrMeta+A');
    await marker(page, 'Green').click();
    await expect(saveStatus(page)).toContainText('All changes saved');

    await page.reload();

    await expect(inkedText(page, 'green')).toHaveText(['Milk', 'Eggs']);
    await expect(inkedText(page, 'blue')).toHaveCount(0);
  });

  test('previews each color in the board collection', async ({page}) => {
    await createBoard(page, 'Mixed');
    await writeOnBoard(page, 'Plain ');
    await marker(page, 'Purple').click();
    await page.keyboard.insertText('fancy');
    await expect(saveStatus(page)).toContainText('All changes saved');

    await page.goBack();

    const preview = page.locator('.board-card__preview span');
    await expect(preview).toHaveText(['Plain ', 'fancy']);
    await expect(preview.nth(1)).toHaveCSS('color', 'rgb(91, 42, 134)');
  });

  test('scrolls long writing inside the board, keeping the board and tray in place', async ({page}) => {
    await createBoard(page, 'Long List');
    const lines = Array.from({length: 60}, (_, index) => `Line ${index + 1}`);
    await writeOnBoard(page, lines.join('\n'));

    // The caret is on the last line, so the writing has scrolled down to it.
    await expect(boardLines(page).last()).toBeInViewport();
    await expect(boardLines(page).first()).not.toBeInViewport();
    await expect(page.getByRole('heading', {name: 'Long List'})).toBeInViewport();
    await expect(marker(page, 'Black')).toBeInViewport();

    const pageScrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    expect(pageScrolls).toBe(false);
  });

  test('keeps the board header compact and scrolls the marker tray on a phone', async ({page}) => {
    await page.setViewportSize({width: 360, height: 640});
    await createBoard(page, 'Pocket Board');
    await writeOnBoard(page, 'Hi');
    await expect(saveStatus(page)).toContainText('All changes saved');

    // The status and delete button stay beside the title rather than wrapping under it.
    const heading = await boundingBox(page.getByRole('heading', {name: 'Pocket Board'}));

    for (const control of [saveStatus(page), page.getByRole('button', {name: 'Delete Pocket Board'})]) {
      const box = await boundingBox(control);
      expect(box.y).toBeLessThan(heading.y + heading.height);
    }

    const tray = await boundingBox(page.locator('.marker-tray'));
    expect(tray.height).toBeLessThan(110);

    // One row of full-size markers that scrolls sideways, rather than wrapping onto more rows.
    const markerRow = page.getByRole('group', {name: 'Marker color'});
    const scrolls = await markerRow.evaluate((row) => row.scrollWidth > row.clientWidth);
    expect(scrolls).toBe(true);
    await expect(marker(page, 'Orange')).not.toBeInViewport();

    // Tapping a marker the row cuts off scrolls it fully into view. Dispatched, since Playwright's own
    // click would scroll it into view first.
    await expect(marker(page, 'Red')).not.toBeInViewport({ratio: 1});
    await marker(page, 'Red').dispatchEvent('click');

    await expect(marker(page, 'Red')).toBeInViewport({ratio: 1});
    await expect(marker(page, 'Red')).toHaveAttribute('aria-pressed', 'true');
  });
});
