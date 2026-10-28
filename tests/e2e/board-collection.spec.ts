import type {Page} from '@playwright/test';

import {expect, test} from '@playwright/test';
import {signIn} from './support/auth';
import {createBoard} from './support/boards';

/** Creates a board, checks it opens, returns to the collection, and returns the board's URL. */
async function createBoardAndGoBack(page: Page, title: string): Promise<string> {
  const boardUrl = await createBoard(page, title);

  await page.goBack();
  await expect(page).toHaveURL(/\/boards$/);

  return boardUrl;
}

function boardCards(page: Page) {
  return page.locator('.board-card');
}

test.describe('board collection', () => {
  test.beforeEach(async ({page}) => {
    await signIn(page);
  });

  test('shows an empty state for a new user', async ({page}) => {
    await expect(page.getByText('No boards yet')).toBeVisible();
    await expect(page.getByRole('button', {name: 'Create your first board'})).toBeVisible();
  });

  test('creates a board, opens it, and lists it', async ({page}) => {
    await createBoardAndGoBack(page, 'Sprint Planning');

    await expect(boardCards(page)).toHaveCount(1);
    await expect(boardCards(page).first()).toContainText('Sprint Planning');
    await expect(boardCards(page).first()).toContainText('Empty board');
  });

  test('opens a board from its card', async ({page}) => {
    await createBoardAndGoBack(page, 'Retro Notes');

    await boardCards(page).first().click();

    await expect(page.getByRole('heading', {name: 'Retro Notes'})).toBeVisible();
  });

  test('requires a title', async ({page}) => {
    await page.getByRole('button', {name: 'New board'}).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', {name: 'Create'}).click();

    await expect(dialog.getByText('Title is required.')).toBeVisible();
    await expect(page).toHaveURL(/\/boards$/);
  });

  test('filters boards by case-insensitive title substring', async ({page}) => {
    await createBoardAndGoBack(page, 'Project Alpha');
    await createBoardAndGoBack(page, 'project beta');
    await createBoardAndGoBack(page, 'Retro Notes');
    await expect(boardCards(page)).toHaveCount(3);

    const search = page.getByRole('textbox', {name: 'Search by title'});
    await search.fill('PROJ');

    await expect(boardCards(page)).toHaveCount(2);
    await expect(boardCards(page).nth(0)).toContainText('Project Alpha');
    await expect(boardCards(page).nth(1)).toContainText('project beta');

    await search.fill('alpha');

    await expect(boardCards(page)).toHaveCount(1);
    await expect(boardCards(page).first()).toContainText('Project Alpha');

    await search.fill('zzz');

    await expect(page.getByText('No matching boards')).toBeVisible();
    await expect(boardCards(page)).toHaveCount(0);

    await search.clear();

    await expect(boardCards(page)).toHaveCount(3);
  });

  test('shows not found for a board that does not exist', async ({page}) => {
    await page.goto('/boards/does-not-exist');

    await expect(page.getByText('Board not found')).toBeVisible();
    await page.getByRole('link', {name: 'Back to my boards'}).click();
    await expect(page).toHaveURL(/\/boards$/);
  });
});

test('users only see and open their own boards', async ({browser}) => {
  const aliceContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  await signIn(alicePage);
  const aliceBoardUrl = await createBoard(alicePage, 'Alice Private Board');

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await signIn(bobPage);

  await expect(bobPage.getByText('No boards yet')).toBeVisible();
  await expect(bobPage.getByText('Alice Private Board')).toHaveCount(0);

  await bobPage.goto(aliceBoardUrl);

  await expect(bobPage.getByText('Board not found')).toBeVisible();
  await expect(bobPage.getByText('Alice Private Board')).toHaveCount(0);

  await aliceContext.close();
  await bobContext.close();
});
