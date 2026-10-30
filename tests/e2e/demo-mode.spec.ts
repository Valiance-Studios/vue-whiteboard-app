import type {Page} from '@playwright/test';

import {expect, test} from '@playwright/test';
import {createBoard, inkedText, marker, saveStatus, writeOnBoard} from './support/boards';

const SAMPLE_BOARD_TITLES = ['A Quick Tour', 'Sprint Planning', 'Weekend Errands'];

function demoModeButton(page: Page) {
  return page.getByRole('button', {name: 'Demo Mode'});
}

/** Starts demo mode for the first time, giving a name. */
async function startDemo(page: Page, name: string): Promise<void> {
  await page.goto('/login');
  await demoModeButton(page).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Your name').fill(name);
  await dialog.getByRole('button', {name: 'Start'}).click();

  await expect(page).toHaveURL(/\/boards$/);
}

test('a first-time visitor gives a name and enters demo mode', async ({page}) => {
  await page.goto('/login');
  await demoModeButton(page).click();
  const dialog = page.getByRole('dialog');

  await dialog.getByRole('button', {name: 'Start'}).click();
  await expect(dialog.getByText('Your name is required.')).toBeVisible();

  await dialog.getByLabel('Your name').fill('Grace Hopper');
  await dialog.getByRole('button', {name: 'Start'}).click();

  await expect(page).toHaveURL(/\/boards$/);
  await expect(page.getByText('Grace Hopper')).toBeVisible();
  await expect(page.getByText('Demo', {exact: true})).toBeVisible();
  await expect(page.locator('.board-card')).toHaveText(SAMPLE_BOARD_TITLES.map((title) => new RegExp(title)));
});

test('a first-time visitor starts with sample boards written in several colors', async ({page}) => {
  await startDemo(page, 'Grace');

  await page.locator('.board-card').filter({hasText: 'A Quick Tour'}).click();

  await expect(page).toHaveURL(/\/boards\/[\w-]+$/);
  await expect(inkedText(page, 'red')).toHaveText('red');
  await expect(inkedText(page, 'green')).toHaveText('green');
});

test('deleted sample boards stay deleted after a reload', async ({page}) => {
  await startDemo(page, 'Grace');
  await page.getByRole('button', {name: 'Delete Weekend Errands'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Delete'}).click();
  await expect(page.locator('.board-card').filter({hasText: 'Weekend Errands'})).toHaveCount(0);

  await page.reload();

  await expect(page.locator('.board-card')).toHaveCount(2);
});

test('the demo link goes straight in as a guest on a first visit', async ({page}) => {
  await page.goto('/demo');

  await expect(page).toHaveURL(/\/boards$/);
  await expect(page.getByRole('banner').getByText('Guest', {exact: true})).toBeVisible();
  await expect(page.getByText('Demo', {exact: true})).toBeVisible();
  await expect(page.locator('.board-card')).toHaveCount(SAMPLE_BOARD_TITLES.length);
});

test('the demo link brings a returning visitor back under their name and boards', async ({page}) => {
  await startDemo(page, 'Grace');
  await createBoard(page, 'Grace Board');
  await page.getByRole('button', {name: 'Sign out'}).click();

  await page.goto('/demo');

  await expect(page).toHaveURL(/\/boards$/);
  await expect(page.getByRole('banner').getByText('Grace', {exact: true})).toBeVisible();
  await expect(page.locator('.board-card')).toContainText(['Grace Board']);
});

test('demo boards are kept in the browser, and a returning visitor goes straight in', async ({page}) => {
  await startDemo(page, 'Grace');
  const boardUrl = await createBoard(page, 'Demo Notes');
  await writeOnBoard(page, 'Local ');
  await marker(page, 'Red').click();
  await page.keyboard.insertText('only');
  await expect(saveStatus(page)).toContainText('All changes saved');

  // Still in demo mode after a reload, with the writing and its colors.
  await page.reload();

  await expect(inkedText(page, 'blue')).toHaveText('Local ');
  await expect(inkedText(page, 'red')).toHaveText('only');

  await page.getByRole('button', {name: 'Sign out'}).click();
  await expect(page).toHaveURL(/\/login$/);

  await demoModeButton(page).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/boards$/);
  await expect(page.getByRole('banner').getByText('Grace', {exact: true})).toBeVisible();
  await expect(page.locator('.board-card')).toContainText(['Demo Notes']);

  await page.goto(boardUrl);

  await expect(inkedText(page, 'red')).toHaveText('only');
});

test('signing out of demo mode requires signing in again', async ({page}) => {
  await startDemo(page, 'Grace');

  await page.getByRole('button', {name: 'Sign out'}).click();
  await page.goto('/boards');

  await expect(page).toHaveURL(/\/login/);
});

test('someone new in the same browser starts fresh after a warning', async ({page}) => {
  await startDemo(page, 'Grace');
  await createBoard(page, 'Grace Board');
  await page.getByRole('button', {name: 'Sign out'}).click();

  await expect(page.getByText('Welcome back,')).toBeVisible();
  await expect(page.getByText('Grace', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Not you?'}).click();
  const dialog = page.getByRole('dialog');

  await expect(dialog.getByText('Starting as someone new deletes Grace\'s demo boards in this browser.')).toBeVisible();

  await dialog.getByLabel('Your name').fill('Alan');
  await dialog.getByRole('button', {name: 'Start'}).click();

  await expect(page).toHaveURL(/\/boards$/);
  await expect(page.getByText('Alan')).toBeVisible();
  await expect(page.locator('.board-card')).toHaveText(SAMPLE_BOARD_TITLES.map((title) => new RegExp(title)));
});

test('cancelling "Not you?" keeps the previous visitor\'s boards', async ({page}) => {
  await startDemo(page, 'Grace');
  await createBoard(page, 'Grace Board');
  await page.getByRole('button', {name: 'Sign out'}).click();

  await page.getByRole('button', {name: 'Not you?'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Cancel'}).click();
  await demoModeButton(page).click();

  await expect(page).toHaveURL(/\/boards$/);
  await expect(page.getByRole('banner').getByText('Grace', {exact: true})).toBeVisible();
  await expect(page.locator('.board-card')).toContainText(['Grace Board']);
});
