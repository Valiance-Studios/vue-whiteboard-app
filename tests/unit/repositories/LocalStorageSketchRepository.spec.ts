import type {Stroke} from '@/types/sketch';

import {beforeEach, describe, expect, it} from 'vitest';
import {clearDemoBoards, LocalStorageBoardRepository} from '@/repositories/LocalStorageBoardRepository';
import {LocalStorageSketchRepository} from '@/repositories/LocalStorageSketchRepository';

function repository(): LocalStorageSketchRepository {
  return new LocalStorageSketchRepository(localStorage);
}

function stroke(id: string, drawnAt: number): Stroke {
  return {id, ink: 'green', pen: true, points: [[10, 20, 0.5], [30, 40, 0.75]], drawnAt};
}

describe('LocalStorageSketchRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps a board\'s strokes, oldest first, across instances', async () => {
    await repository().add('b1', stroke('later', 2));
    await repository().add('b1', stroke('earlier', 1));

    const strokes = await repository().list('b1');

    expect(strokes.map((saved) => saved.id)).toEqual(['earlier', 'later']);
    expect(strokes[0]).toEqual(stroke('earlier', 1));
  });

  it('keeps each board\'s strokes apart', async () => {
    await repository().add('b1', stroke('a', 1));

    await expect(repository().list('b2')).resolves.toEqual([]);
  });

  it('removes a stroke, and rejects removing one that does not exist', async () => {
    await repository().add('b1', stroke('a', 1));

    await repository().remove('b1', 'a');

    await expect(repository().list('b1')).resolves.toEqual([]);
    await expect(repository().remove('b1', 'a')).rejects.toThrow();
  });

  it('adds a stroke back under the same id, as undoing an erase does', async () => {
    await repository().add('b1', stroke('a', 1));
    await repository().remove('b1', 'a');

    await repository().add('b1', stroke('a', 1));

    await expect(repository().list('b1')).resolves.toHaveLength(1);
  });

  it('deletes a board\'s strokes along with the board', async () => {
    const boards = new LocalStorageBoardRepository(localStorage, 'demo');
    const id = await boards.create({title: 'Sketchy'});
    await repository().add(id, stroke('a', 1));

    await boards.delete(id);

    await expect(repository().list(id)).resolves.toEqual([]);
  });

  it('deletes every board\'s strokes when someone new starts demo mode', async () => {
    await repository().add('b1', stroke('a', 1));
    await repository().add('b2', stroke('b', 1));
    localStorage.setItem('whiteboard.theme', 'dark');

    clearDemoBoards(localStorage);

    await expect(repository().list('b1')).resolves.toEqual([]);
    await expect(repository().list('b2')).resolves.toEqual([]);
    expect(localStorage.getItem('whiteboard.theme')).toBe('dark');
  });
});
