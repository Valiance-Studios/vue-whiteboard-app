import {expect, test} from '@playwright/test';
import {signIn} from './support/auth';
import {boardText, createBoard, saveStatus} from './support/boards';

test.describe('board editing', () => {
  test.beforeEach(async ({page}) => {
    await signIn(page);
  });

  test('saves writing after a pause and keeps it after a reload', async ({page}) => {
    await createBoard(page, 'Shopping List');

    await expect(saveStatus(page)).toBeHidden();

    await boardText(page).fill('Milk\nEggs');

    await expect(saveStatus(page)).toContainText('All changes saved');

    await page.reload();

    await expect(boardText(page)).toHaveValue('Milk\nEggs');
  });

  test('saves the latest writing when several edits follow each other', async ({page}) => {
    const boardUrl = await createBoard(page, 'Running Notes');
    const text = boardText(page);

    await text.fill('first');
    await text.fill('second');
    await text.fill('third');

    await expect(saveStatus(page)).toContainText('All changes saved');

    await page.goto(boardUrl);

    await expect(boardText(page)).toHaveValue('third');
  });

  test('saves pending writing when leaving the board before the pause', async ({page}) => {
    const boardUrl = await createBoard(page, 'Quick Note');

    // No wait here: the edit is still pending when the navigation starts.
    await boardText(page).fill('Written on the way out');
    await page.goBack();
    await expect(page).toHaveURL(/\/boards$/);

    await page.goto(boardUrl);

    await expect(boardText(page)).toHaveValue('Written on the way out');
  });

  test('shows saved writing in the board collection', async ({page}) => {
    await createBoard(page, 'Preview Board');
    await boardText(page).fill('A line worth previewing');
    await expect(saveStatus(page)).toContainText('All changes saved');

    await page.goBack();

    await expect(page.locator('.board-card').first()).toContainText('A line worth previewing');
  });
});
