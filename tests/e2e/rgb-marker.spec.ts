import type {Page} from '@playwright/test';

import {expect, test} from '@playwright/test';
import {signIn} from './support/auth';
import {boardText, colorPanel, createBoard, inkedText, marker, openColorPanel, saveStatus, writeOnBoard} from './support/boards';

const DEFAULT_COLOR = '#d81b60';

/**
 * Reloads with nothing kept in this browser, so Firestore is the only place holding the settings.
 * Waits first, since a reload straight after a change cancels a write still on its way out.
 */
async function expectAfterReloadFromFirestore(page: Page, check: () => Promise<void>): Promise<void> {
  await page.waitForTimeout(1_000);

  await expect(async () => {
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await check();
  }).toPass({timeout: 15_000});
}

test.describe('RGB marker', () => {
  test.beforeEach(async ({page}) => {
    await signIn(page);
  });

  test('is the first marker on the tray', async ({page}) => {
    await createBoard(page, 'Order');

    await expect(page.getByRole('group', {name: 'Marker color'}).getByRole('button').first()).toHaveAccessibleName('RGB marker');
  });

  test('fits beside the label on one row on a desktop, whichever marker is in hand', async ({page}) => {
    await page.setViewportSize({width: 1280, height: 800});
    await createBoard(page, 'One row');
    await marker(page, 'Purple').click();

    const label = page.getByText('Marker · Purple');
    const labelBox = await label.boundingBox();
    const rowBox = await page.getByRole('group', {name: 'Marker color'}).boundingBox();

    expect(labelBox && rowBox && labelBox.x + labelBox.width <= rowBox.x + 8).toBe(true);
    expect(labelBox && rowBox && labelBox.y >= rowBox.y).toBe(true);
  });

  test('picks the marker on the first click and opens the panel on the second', async ({page}) => {
    await createBoard(page, 'Clicks');
    const rgbMarker = marker(page, 'RGB');

    await rgbMarker.click();

    await expect(rgbMarker).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Marker · RGB')).toBeVisible();
    await expect(colorPanel(page)).toBeHidden();

    await rgbMarker.click();

    await expect(colorPanel(page)).toBeVisible();
    await expect(rgbMarker).toHaveAttribute('aria-expanded', 'true');

    await rgbMarker.click();

    await expect(colorPanel(page)).toBeHidden();
    await expect(rgbMarker).toHaveAttribute('aria-pressed', 'true');
  });

  test('keeps the spectrum, RGB and hex values in step', async ({page}) => {
    await createBoard(page, 'Fields');
    const panel = await openColorPanel(page);
    const hex = panel.getByLabel('Hex');
    const red = panel.getByLabel('Red');
    const green = panel.getByLabel('Green');
    const blue = panel.getByLabel('Blue');

    await expect(hex).toHaveValue(DEFAULT_COLOR);
    await expect(red).toHaveValue('216');

    await hex.fill('#102030');

    await expect(red).toHaveValue('16');
    await expect(green).toHaveValue('32');
    await expect(blue).toHaveValue('48');

    await blue.fill('255');

    await expect(hex).toHaveValue('#1020ff');

    // A click on the spectrum updates both, away from the color the fields just set.
    const canvas = panel.locator('canvas');
    await canvas.click({position: {x: 200, y: 20}});

    await expect(hex).not.toHaveValue('#1020ff');
    const picked = await hex.inputValue();
    const expectedRed = String(Number.parseInt(picked.slice(1, 3), 16));

    await expect(red).toHaveValue(expectedRed);
  });

  test('accepts a short or unprefixed hex value, and restores an invalid one on leaving the field', async ({page}) => {
    await createBoard(page, 'Typing');
    const panel = await openColorPanel(page);
    const hex = panel.getByLabel('Hex');
    const red = panel.getByLabel('Red');

    await hex.fill('abc');

    await expect(red).toHaveValue('170');

    await hex.fill('nope');
    await red.click();

    await expect(hex).toHaveValue('#aabbcc');

    await red.fill('300');

    await expect(hex).toHaveValue('#aabbcc');

    await hex.click();

    await expect(red).toHaveValue('170');
  });

  test('writes in the chosen color, and earlier writing keeps its color when the marker changes', async ({page}) => {
    await createBoard(page, 'Writing');
    let panel = await openColorPanel(page);
    await panel.getByLabel('Hex').fill('#123456');
    await page.keyboard.press('Enter');
    await expect(colorPanel(page)).toBeHidden();

    // Closing the panel hands the keyboard back to the board.
    await page.keyboard.insertText('first ');

    panel = await openColorPanel(page);
    await panel.getByLabel('Hex').fill('#654321');
    await page.keyboard.press('Escape');
    await expect(colorPanel(page)).toBeHidden();
    await page.keyboard.insertText('second');
    await expect(saveStatus(page)).toContainText('All changes saved');

    await page.reload();

    await expect(inkedText(page, '#123456')).toHaveText('first ');
    await expect(inkedText(page, '#654321')).toHaveText('second');
    await expect(inkedText(page, '#654321')).toHaveCSS('color', 'rgb(101, 67, 33)');
  });

  test('recolors the selected writing as the color changes', async ({page}) => {
    await createBoard(page, 'Recolor');
    await writeOnBoard(page, 'Hello');
    await page.keyboard.press('ControlOrMeta+A');

    const panel = await openColorPanel(page);

    await expect(inkedText(page, DEFAULT_COLOR)).toHaveText('Hello');

    await panel.getByLabel('Hex').fill('#123456');

    await expect(inkedText(page, '#123456')).toHaveText('Hello');
  });

  test('closes the panel when the board or another marker is clicked', async ({page}) => {
    await createBoard(page, 'Closing');

    await openColorPanel(page);
    await boardText(page).click();
    await expect(colorPanel(page)).toBeHidden();

    await openColorPanel(page);
    await marker(page, 'Red').click();
    await expect(colorPanel(page)).toBeHidden();
    await expect(marker(page, 'Red')).toHaveAttribute('aria-pressed', 'true');
  });

  test('saves the color to the user\'s settings', async ({page}) => {
    await createBoard(page, 'Saved');
    const panel = await openColorPanel(page);
    await panel.getByLabel('Hex').fill('#123456');
    await page.keyboard.press('Enter');
    await expect(colorPanel(page)).toBeHidden();

    await expectAfterReloadFromFirestore(page, async () => {
      const reopened = await openColorPanel(page);
      await expect(reopened.getByLabel('Hex')).toHaveValue('#123456', {timeout: 2_000});
    });
  });

  test('fits on a phone', async ({page}) => {
    await page.setViewportSize({width: 360, height: 640});
    await createBoard(page, 'Phone');

    const panel = await openColorPanel(page);

    await expect(panel).toBeInViewport({ratio: 1});
  });
});

test('keeps a demo visitor\'s color in this browser', async ({page}) => {
  await page.goto('/demo');
  await page.getByRole('link', {name: 'A Quick Tour'}).click();
  const panel = await openColorPanel(page);
  await panel.getByLabel('Hex').fill('#123456');
  await page.keyboard.press('Enter');
  await expect(colorPanel(page)).toBeHidden();

  expect(await page.evaluate(() => localStorage.getItem('whiteboard.customMarkerColor'))).toBe('#123456');

  await page.reload();

  const reopened = await openColorPanel(page);
  await expect(reopened.getByLabel('Hex')).toHaveValue('#123456');
});

test('saves a signed-in user\'s theme to their settings', async ({page}) => {
  await page.emulateMedia({colorScheme: 'light'});
  await signIn(page);

  await page.getByRole('button', {name: 'Switch to dark mode'}).click();
  await expect(page.locator('.v-application')).toHaveClass(/v-theme--dark/);

  await expectAfterReloadFromFirestore(page, async () => {
    await expect(page.locator('.v-application')).toHaveClass(/v-theme--dark/, {timeout: 2_000});
  });
});
