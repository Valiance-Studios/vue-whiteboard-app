import type {Locator, Page} from '@playwright/test';

import {expect, test} from '@playwright/test';
import {signIn} from './support/auth';
import {boardText, createBoard, marker, saveStatus, writeOnBoard} from './support/boards';

const WIDE_SCREENS = [
  {name: 'a desktop', width: 1280, height: 800},
  {name: 'an iPad in landscape', width: 1180, height: 820},
  {name: 'an iPad in portrait', width: 820, height: 1180},
  {name: 'a small iPad in portrait', width: 744, height: 1133},
];

async function box(locator: Locator): Promise<{x: number; y: number; width: number; height: number}> {
  const found = await locator.boundingBox();

  if (!found) {
    throw new Error('Expected the element to be visible.');
  }

  return found;
}

function appBar(page: Page): Locator {
  return page.getByRole('banner');
}

function titleButton(page: Page, title: string): Locator {
  return page.getByRole('heading', {name: title}).getByRole('button');
}

test.describe('board controls in the app bar', () => {
  for (const {name, width, height} of WIDE_SCREENS) {
    test(`are centered on the bar on ${name}, with the full-screen button on the board`, async ({page}) => {
      await page.setViewportSize({width, height});
      await signIn(page);
      await createBoard(page, 'In the bar');

      const bar = appBar(page);
      const title = await box(titleButton(page, 'In the bar'));
      const remove = await box(bar.getByRole('button', {name: 'Delete In the bar'}));
      const center = (title.x + remove.x + remove.width) / 2;

      expect(title.x).toBeLessThan(remove.x);
      expect(Math.abs(center - width / 2)).toBeLessThan(6);
      await expect(page.getByRole('link', {name: 'My Boards'})).toHaveCount(0);
      await expect(page.locator('.whiteboard-sheet__board').getByRole('button', {name: 'Enter full screen'})).toBeVisible();

      // The board starts just under the bar.
      const barBox = await box(bar);

      expect((await box(page.locator('.whiteboard-sheet'))).y).toBeLessThan(barBox.y + barBox.height + 20);
    });
  }

  for (const {name, width, height} of WIDE_SCREENS.filter((screen) => screen.width >= 820)) {
    test(`show every marker on one row on ${name}`, async ({page}) => {
      await page.setViewportSize({width, height});
      await signIn(page);
      await createBoard(page, 'One row');

      expect((await box(marker(page, 'Orange'))).y).toBe((await box(marker(page, 'Black'))).y);
      await expect(marker(page, 'RGB')).toBeInViewport({ratio: 1});
      await expect(marker(page, 'Orange')).toBeInViewport({ratio: 1});
    });
  }

  test('scroll the markers on one row where they do not all fit', async ({page}) => {
    await page.setViewportSize({width: 744, height: 1133});
    await signIn(page);
    await createBoard(page, 'Scrolling');

    expect((await box(marker(page, 'Orange'))).y).toBe((await box(marker(page, 'Black'))).y);
    await expect(marker(page, 'Orange')).not.toBeInViewport({ratio: 1});

    await marker(page, 'Orange').dispatchEvent('click');

    await expect(marker(page, 'Orange')).toBeInViewport({ratio: 1});
  });

  test('cut a long title short, keeping every control on screen', async ({page}) => {
    await page.setViewportSize({width: 744, height: 1133});
    await signIn(page);
    const title = 'A very long board title that could never fit across the app bar of a small tablet held upright';
    await createBoard(page, title);

    await expect(appBar(page).getByRole('button', {name: `Delete ${title}`})).toBeInViewport({ratio: 1});
    await expect(page.getByRole('button', {name: 'Sign out'})).toBeInViewport({ratio: 1});
    expect((await box(page.getByRole('banner'))).height).toBeLessThanOrEqual(65);
    await expect(titleButton(page, title)).toHaveAttribute('title', `Rename ${title}`);
  });

  test('show a title in full when there is room', async ({page}) => {
    await signIn(page);
    await createBoard(page, 'A Quick Tour');

    const cutShort = await titleButton(page, 'A Quick Tour').locator('span').first().evaluate((text) => text.scrollWidth > text.clientWidth);

    expect(cutShort).toBe(false);
  });

  test('rename in place, showing an error below the field', async ({page}) => {
    await signIn(page);
    await createBoard(page, 'Before');

    await titleButton(page, 'Before').click();
    const field = appBar(page).getByLabel('Board title');
    await field.fill(' ');
    await page.keyboard.press('Enter');

    const message = page.getByText('required', {exact: false});

    await expect(message).toBeVisible();
    expect((await box(message)).y).toBeGreaterThanOrEqual((await box(field)).y);

    await field.fill('After');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', {name: 'After'})).toBeVisible();
  });

  test('keep the title in place as the save status appears', async ({page}) => {
    await signIn(page);
    await createBoard(page, 'Status');
    const before = await box(titleButton(page, 'Status'));

    await writeOnBoard(page, 'Hello');

    await expect(appBar(page).getByRole('status')).toContainText('All changes saved');
    expect((await box(titleButton(page, 'Status'))).x).toBe(before.x);
  });

  test('keep the save status clear of the account controls beside a long title', async ({page}) => {
    await page.setViewportSize({width: 1145, height: 800});
    await signIn(page);
    const title = 'A very long board title that could never fit across the app bar of even a fairly wide screen';
    await createBoard(page, title);

    await writeOnBoard(page, 'Hello');

    const status = await box(appBar(page).getByRole('status'));
    await expect(appBar(page).getByRole('status')).toContainText('All changes saved');

    expect(status.x + status.width).toBeLessThanOrEqual((await box(appBar(page).getByRole('button', {name: 'About this app'}))).x);
  });
});

test('a phone on its side keeps the controls in the app bar and shows every marker', async ({page}) => {
  await page.setViewportSize({width: 844, height: 390});
  await signIn(page);
  await createBoard(page, 'Landscape');

  await expect(appBar(page).getByRole('heading', {name: 'Landscape'})).toBeVisible();
  expect((await box(marker(page, 'Green'))).y).toBe((await box(marker(page, 'Black'))).y);
  await expect(marker(page, 'Orange')).toBeInViewport({ratio: 1});
});

test('a phone keeps the controls in the page, and the full-screen button on the board', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await signIn(page);
  await createBoard(page, 'Phone');

  await expect(appBar(page).getByRole('heading', {name: 'Phone'})).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('heading', {name: 'Phone'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'My Boards'})).toBeVisible();
  await expect(page.locator('.whiteboard-sheet__board').getByRole('button', {name: 'Enter full screen'})).toBeVisible();
  await expect(boardText(page)).toBeVisible();

  // A short title has room on one line.
  const heading = await box(page.getByRole('heading', {name: 'Phone'}));

  expect(heading.height).toBeLessThan(40);

  await writeOnBoard(page, 'Hi');
  await expect(saveStatus(page)).toContainText('All changes saved');
});
