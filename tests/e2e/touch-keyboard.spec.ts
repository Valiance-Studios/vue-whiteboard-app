import type {Page} from '@playwright/test';

import {expect, test} from '@playwright/test';
import {signIn} from './support/auth';
import {boardText, colorPanel, createBoard, inkedText, marker} from './support/boards';

// A phone's on-screen keyboard shows while the editor has focus, so focus stands in for the keyboard here.
test.use({hasTouch: true, isMobile: true, viewport: {width: 412, height: 839}});

/** Closing the on-screen keyboard takes focus off the editor. */
async function closeKeyboard(page: Page): Promise<void> {
  await boardText(page).blur();
  await expect(boardText(page)).not.toBeFocused();
}

/** Checks the keyboard stayed closed, a few frames on, because Tiptap focuses the editor in an animation frame. */
async function expectKeyboardClosed(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }));
  await expect(boardText(page)).not.toBeFocused();
}

test.describe('the on-screen keyboard and the marker tray', () => {
  test.beforeEach(async ({page}) => {
    await signIn(page);
    await createBoard(page, 'Touch Board');
    await boardText(page).tap();
    await expect(boardText(page)).toBeFocused();
  });

  test('picking a marker leaves a closed keyboard closed, and the marker still writes', async ({page}) => {
    await closeKeyboard(page);

    await marker(page, 'Red').tap();

    await expect(marker(page, 'Red')).toHaveAttribute('aria-pressed', 'true');
    await expectKeyboardClosed(page);

    await boardText(page).tap();
    await expect(boardText(page)).toBeFocused();
    await page.keyboard.type('Red words');
    await expect(inkedText(page, 'red')).toHaveText('Red words');
  });

  test('picking a marker leaves an open keyboard open', async ({page}) => {
    await marker(page, 'Red').tap();

    await expect(marker(page, 'Red')).toHaveAttribute('aria-pressed', 'true');
    await expect(boardText(page)).toBeFocused();
  });

  test('picking a marker recolors selected text with the keyboard closed', async ({page}) => {
    await page.keyboard.type('Some words');
    await page.keyboard.press('ControlOrMeta+A');
    await closeKeyboard(page);

    await marker(page, 'Green').tap();

    await expect(inkedText(page, 'green')).toHaveText('Some words');
    await expectKeyboardClosed(page);
  });

  test('closing the color panel leaves the keyboard closed', async ({page}) => {
    await marker(page, 'RGB').tap();
    await marker(page, 'RGB').tap();
    await expect(colorPanel(page)).toBeFocused();

    await marker(page, 'RGB').tap();

    await expect(colorPanel(page)).toBeHidden();
    await expectKeyboardClosed(page);
  });
});
