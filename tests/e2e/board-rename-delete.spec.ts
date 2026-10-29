import type {Page} from '@playwright/test';

import {expect, test} from '@playwright/test';
import {signIn} from './support/auth';
import {boardText, createBoard, saveStatus, writeOnBoard} from './support/boards';

function boardCard(page: Page, title: string) {
  return page.locator('.board-card').filter({hasText: title});
}

/** The board's title, which is a button that turns into a text field. */
function boardTitle(page: Page, title: string) {
  return page.getByRole('heading', {name: title}).getByRole('button');
}

test.describe('renaming and deleting boards', () => {
  test.beforeEach(async ({page}) => {
    await signIn(page);
  });

  test('renames a board from its card', async ({page}) => {
    await createBoard(page, 'Old Name');
    await page.goBack();

    await page.getByRole('button', {name: 'Rename Old Name'}).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Title')).toHaveValue('Old Name');

    await dialog.getByLabel('Title').fill('');
    await dialog.getByRole('button', {name: 'Rename'}).click();
    await expect(dialog.getByText('Title is required.')).toBeVisible();

    await dialog.getByLabel('Title').fill('New Name');
    await dialog.getByRole('button', {name: 'Rename'}).click();

    await expect(dialog).toBeHidden();
    await expect(boardCard(page, 'New Name')).toHaveCount(1);
    await expect(boardCard(page, 'Old Name')).toHaveCount(0);

    // The rename was saved, not just shown.
    await page.reload();
    await expect(boardCard(page, 'New Name')).toHaveCount(1);
  });

  test('deletes a board from its card after confirming', async ({page}) => {
    await createBoard(page, 'Keep Me');
    await page.goBack();
    await createBoard(page, 'Delete Me');
    await page.goBack();

    await page.getByRole('button', {name: 'Delete Delete Me'}).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Delete “Delete Me”?')).toBeVisible();

    // Cancelling keeps the board.
    await dialog.getByRole('button', {name: 'Cancel'}).click();
    await expect(boardCard(page, 'Delete Me')).toHaveCount(1);

    await page.getByRole('button', {name: 'Delete Delete Me'}).click();
    await dialog.getByRole('button', {name: 'Delete'}).click();

    await expect(boardCard(page, 'Delete Me')).toHaveCount(0);
    await expect(boardCard(page, 'Keep Me')).toHaveCount(1);

    await page.reload();
    await expect(boardCard(page, 'Delete Me')).toHaveCount(0);
  });

  test('renames a board by editing its title', async ({page}) => {
    await createBoard(page, 'Draft Title');

    await boardTitle(page, 'Draft Title').click();
    const field = page.getByRole('textbox', {name: 'Board title'});
    await expect(field).toHaveValue('Draft Title');

    // Escape cancels.
    await field.fill('Abandoned');
    await field.press('Escape');
    await expect(page.getByRole('heading', {name: 'Draft Title'})).toBeVisible();

    // A blank title is refused and the field stays open.
    await boardTitle(page, 'Draft Title').click();
    await field.fill('   ');
    await field.press('Enter');
    await expect(page.getByText('Title is required.')).toBeVisible();

    await field.fill('Final Title');
    await field.press('Enter');

    await expect(page.getByRole('heading', {name: 'Final Title'})).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', {name: 'Final Title'})).toBeVisible();
  });

  test('saves a rename made straight after writing, and keeps the writing', async ({page}) => {
    await createBoard(page, 'Busy Board');
    await writeOnBoard(page, 'Written first');

    // No wait for the save: the rename has to queue behind it.
    await boardTitle(page, 'Busy Board').click();
    const field = page.getByRole('textbox', {name: 'Board title'});
    await field.fill('Renamed Busy Board');
    await field.press('Enter');

    await expect(page.getByRole('heading', {name: 'Renamed Busy Board'})).toBeVisible();
    await expect(saveStatus(page)).toContainText('All changes saved');

    await page.reload();
    await expect(page.getByRole('heading', {name: 'Renamed Busy Board'})).toBeVisible();
    await expect(boardText(page)).toHaveText('Written first');
  });

  test('saves a title edit when the field loses focus', async ({page}) => {
    await createBoard(page, 'Blur Me');

    await boardTitle(page, 'Blur Me').click();
    await page.getByRole('textbox', {name: 'Board title'}).fill('Blurred');
    await boardText(page).click();

    await expect(page.getByRole('heading', {name: 'Blurred'})).toBeVisible();
  });

  test('deletes a board from its page and returns to the collection', async ({page}) => {
    await createBoard(page, 'Short Lived');
    await writeOnBoard(page, 'Soon gone');

    await page.getByRole('button', {name: 'Delete Short Lived'}).click();
    await page.getByRole('dialog').getByRole('button', {name: 'Delete'}).click();

    await expect(page).toHaveURL(/\/boards$/);
    await expect(boardCard(page, 'Short Lived')).toHaveCount(0);
    await expect(page.getByText('No boards yet')).toBeVisible();
  });
});
