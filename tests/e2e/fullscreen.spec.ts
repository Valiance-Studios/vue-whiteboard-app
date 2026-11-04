import type {Page} from '@playwright/test';

import {expect, test} from '@playwright/test';
import {signIn} from './support/auth';
import {boardText, colorPanel, createBoard, marker, openColorPanel, saveStatus, writeOnBoard} from './support/boards';

const VIEWPORT = {width: 1280, height: 720};

function enterButton(page: Page) {
  return page.getByRole('button', {name: 'Enter full screen'});
}

function exitButton(page: Page) {
  return page.getByRole('button', {name: 'Exit full screen'});
}

function browserIsFullscreen(page: Page): Promise<boolean> {
  return page.evaluate(() => document.fullscreenElement !== null);
}

function sheetIsOnTopAt(page: Page, x: number, y: number): Promise<boolean> {
  return page.evaluate(([left, top]) => Boolean(document.elementFromPoint(left, top)?.closest('.whiteboard-sheet')), [x, y]);
}

test.describe('full screen', () => {
  test.beforeEach(async ({page}) => {
    await page.setViewportSize(VIEWPORT);
    await signIn(page);
    await createBoard(page, 'Big');
  });

  test('gives the board and tray the whole screen, and returns on the same button', async ({page}) => {
    const header = page.getByRole('heading', {name: 'Big'});

    await enterButton(page).click();

    await expect(exitButton(page)).toBeVisible();
    await expect.poll(() => browserIsFullscreen(page)).toBe(true);

    // The sheet fills the screen, with the tray along its bottom edge.
    const sheet = await page.locator('.whiteboard-sheet').boundingBox();
    const viewport = page.viewportSize();

    expect(sheet).toEqual({x: 0, y: 0, width: viewport?.width, height: viewport?.height});

    const tray = await page.locator('.marker-tray').boundingBox();

    expect(tray && tray.y + tray.height).toBe(viewport?.height);
    await expect(marker(page, 'Orange')).toBeInViewport({ratio: 1});

    // The sheet covers the app bar and the header, rather than just being as big as the screen.
    expect(await sheetIsOnTopAt(page, VIEWPORT.width / 2, 20)).toBe(true);
    expect(await sheetIsOnTopAt(page, 300, 150)).toBe(true);

    await exitButton(page).click();

    await expect(enterButton(page)).toBeVisible();
    await expect.poll(() => browserIsFullscreen(page)).toBe(false);
    await expect(header).toBeInViewport();
    expect(await sheetIsOnTopAt(page, VIEWPORT.width / 2, 20)).toBe(false);
  });

  test('keeps writing, the markers and the color panel working', async ({page}) => {
    await writeOnBoard(page, 'Before ');
    await enterButton(page).click();
    await expect(exitButton(page)).toBeVisible();

    // The button leaves the caret on the board.
    await page.keyboard.insertText('during');
    await expect(boardText(page)).toContainText('Before during');
    await expect(saveStatus(page)).toContainText('All changes saved');

    const panel = await openColorPanel(page);

    await expect(panel).toBeInViewport({ratio: 1});

    await panel.getByLabel('Hex').fill('#123456');
    await page.keyboard.press('Enter');
    await expect(colorPanel(page)).toBeHidden();

    await expect(marker(page, 'RGB')).toHaveAttribute('aria-pressed', 'true');
  });

  test('follows the browser leaving full screen by itself', async ({page}) => {
    await enterButton(page).click();
    await expect.poll(() => browserIsFullscreen(page)).toBe(true);

    // Later than an exit the browser forces straight after entering.
    await page.waitForTimeout(600);
    await page.evaluate(() => document.exitFullscreen());

    await expect(enterButton(page)).toBeVisible();
  });

  test('stays filling the window when the browser forces an exit straight after entering, as iPad Safari does', async ({page}) => {
    // Exits from the event itself, so the test does not depend on how quickly it can follow the browser.
    await page.evaluate(() => {
      document.addEventListener('fullscreenchange', () => {
        void document.exitFullscreen();
      }, {once: true});
    });

    await enterButton(page).click();
    await expect.poll(() => browserIsFullscreen(page)).toBe(false);

    await expect(exitButton(page)).toBeVisible();
    expect(await page.locator('.whiteboard-sheet').boundingBox()).toEqual({x: 0, y: 0, ...VIEWPORT});

    await exitButton(page).click();

    await expect(enterButton(page)).toBeVisible();
  });

  test('still fills the window where the browser refuses', async ({page}) => {
    await page.evaluate(() => {
      document.documentElement.requestFullscreen = () => Promise.reject(new TypeError('Not allowed'));
    });

    await enterButton(page).click();

    await expect(exitButton(page)).toBeVisible();

    const sheet = await page.locator('.whiteboard-sheet').boundingBox();

    expect(sheet).toEqual({x: 0, y: 0, ...VIEWPORT});

    await exitButton(page).click();

    await expect(enterButton(page)).toBeVisible();
  });

  test('leaves full screen when leaving the board', async ({page}) => {
    await enterButton(page).click();
    await expect.poll(() => browserIsFullscreen(page)).toBe(true);

    await page.goBack();

    await expect(page).toHaveURL(/\/boards$/);
    await expect.poll(() => browserIsFullscreen(page)).toBe(false);
  });
});
