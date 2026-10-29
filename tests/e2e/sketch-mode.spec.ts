import type {Page} from '@playwright/test';

import {expect, test} from '@playwright/test';
import {signIn} from './support/auth';
import {boardText, createBoard, dragOnBoard, marker, saveStatus, setBoardMode, strokes, trayButton, writeOnBoard} from './support/boards';

async function expectSaved(page: Page): Promise<void> {
  await expect(saveStatus(page)).toContainText('All changes saved');
}

test.describe('sketch mode', () => {
  test.beforeEach(async ({page}) => {
    await signIn(page);
  });

  test('sketches in the marker in hand and keeps the sketch after a reload', async ({page}) => {
    await createBoard(page, 'Sketchbook');
    await setBoardMode(page, 'Sketch');
    await marker(page, 'Red').click();

    await dragOnBoard(page, [0.2, 0.3], [0.6, 0.4]);

    await expect(strokes(page)).toHaveCount(1);
    await expect(strokes(page).first()).toHaveAttribute('data-ink', 'red');
    await expectSaved(page);

    await page.reload();

    await expect(strokes(page)).toHaveCount(1);
    await expect(strokes(page).first()).toHaveAttribute('data-ink', 'red');
  });

  test('locks the writing while sketching', async ({page}) => {
    await createBoard(page, 'Locked');
    await writeOnBoard(page, 'Typed');
    await expectSaved(page);

    await setBoardMode(page, 'Sketch');
    await expect(boardText(page)).toHaveAttribute('contenteditable', 'false');

    await setBoardMode(page, 'Text');
    await expect(boardText(page)).toHaveAttribute('contenteditable', 'true');
    await page.keyboard.insertText(' more');
    await expect(boardText(page)).toHaveText('Typed more');
  });

  test('undoes and redoes sketching, and saves where it ends up', async ({page}) => {
    await createBoard(page, 'Undo');
    await setBoardMode(page, 'Sketch');
    const undo = trayButton(page, 'Undo sketch');
    const redo = trayButton(page, 'Redo sketch');
    await expect(undo).toBeDisabled();

    await dragOnBoard(page, [0.1, 0.2], [0.4, 0.2]);
    await dragOnBoard(page, [0.1, 0.5], [0.4, 0.5]);
    await expect(strokes(page)).toHaveCount(2);

    await undo.click();
    await expect(strokes(page)).toHaveCount(1);
    await undo.click();
    await expect(strokes(page)).toHaveCount(0);
    await expect(undo).toBeDisabled();

    await redo.click();
    await expect(strokes(page)).toHaveCount(1);
    await expectSaved(page);

    await page.reload();

    await expect(strokes(page)).toHaveCount(1);
  });

  test('erases whole strokes, and undoes an erase', async ({page}) => {
    await createBoard(page, 'Eraser');
    await setBoardMode(page, 'Sketch');
    await dragOnBoard(page, [0.1, 0.2], [0.5, 0.2]);
    await dragOnBoard(page, [0.1, 0.6], [0.5, 0.6]);
    await expect(strokes(page)).toHaveCount(2);

    await trayButton(page, 'Eraser').click();
    // Crosses only the first stroke, which goes completely.
    await dragOnBoard(page, [0.3, 0.1], [0.3, 0.3]);

    await expect(strokes(page)).toHaveCount(1);
    await expectSaved(page);
    await page.reload();
    await expect(strokes(page)).toHaveCount(1);

    await setBoardMode(page, 'Sketch');
    await trayButton(page, 'Eraser').click();
    await dragOnBoard(page, [0.3, 0.5], [0.3, 0.7]);
    await expect(strokes(page)).toHaveCount(0);

    await trayButton(page, 'Undo sketch').click();
    await expect(strokes(page)).toHaveCount(1);
  });

  test('marks a sketched board in the collection', async ({page}) => {
    await createBoard(page, 'Plain Board');
    await page.goBack();
    await createBoard(page, 'Sketched Board');
    await setBoardMode(page, 'Sketch');
    await dragOnBoard(page, [0.2, 0.2], [0.5, 0.5]);
    await expectSaved(page);

    await page.goBack();

    const card = (title: string) => page.locator('.board-card').filter({hasText: title});
    await expect(card('Sketched Board').getByRole('img', {name: 'Has sketches'})).toBeVisible();
    await expect(card('Plain Board').getByRole('img', {name: 'Has sketches'})).toHaveCount(0);
  });
});

test('keeps demo mode sketches in the browser', async ({page}) => {
  await page.goto('/login');
  await page.getByRole('button', {name: 'Demo Mode'}).click();
  await page.getByRole('dialog').getByLabel('Your name').fill('Grace');
  await page.getByRole('dialog').getByRole('button', {name: 'Start'}).click();
  await createBoard(page, 'Demo Sketch');
  await setBoardMode(page, 'Sketch');

  await dragOnBoard(page, [0.2, 0.3], [0.6, 0.4]);
  await expectSaved(page);
  await page.reload();

  await expect(strokes(page)).toHaveCount(1);
});
