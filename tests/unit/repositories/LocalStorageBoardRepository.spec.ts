import {beforeEach, describe, expect, it, vi} from 'vitest';
import {LocalStorageBoardRepository} from '@/repositories/LocalStorageBoardRepository';

const BOARDS_KEY = 'whiteboard.demo.boards';

function repository(): LocalStorageBoardRepository {
  // A new instance per call, as `createBoardRepository` makes them.
  return new LocalStorageBoardRepository(localStorage, 'demo');
}

describe('LocalStorageBoardRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a board with a trimmed title, searchable title, and audit stamps', async () => {
    const id = await repository().create({title: '  Sprint Plan  '});

    const board = await repository().get(id);

    expect(board).toMatchObject({id, title: 'Sprint Plan', titleSearchable: 'sprint plan', content: '', inks: []});
    expect(board?.createdAt.uid).toBe('demo');
    expect(board?.createdAt.time).toBeInstanceOf(Date);
  });

  it('lists every board, kept across instances', async () => {
    await repository().create({title: 'Zebra'});
    await repository().create({title: 'Apple'});

    expect((await repository().list()).map((board) => board.title).sort()).toEqual(['Apple', 'Zebra']);
  });

  it('starts empty', async () => {
    await expect(repository().list()).resolves.toEqual([]);
    await expect(repository().get('missing')).resolves.toBeNull();
  });

  it('saves writing and its colors, and re-stamps updatedAt', async () => {
    const id = await repository().create({title: 'Notes'});
    const created = await repository().get(id);
    const inks = [{ink: 'blue' as const, length: 6}, {ink: 'red' as const, length: 5}];

    await repository().update(id, {content: 'Hello world', inks});
    const updated = await repository().get(id);

    expect(updated).toMatchObject({content: 'Hello world', inks});
    expect(updated?.createdAt).toEqual(created?.createdAt);
    expect(updated?.updatedAt.time.getTime()).toBeGreaterThanOrEqual(created?.updatedAt.time.getTime() ?? 0);
  });

  it('renames a board, trimming the title and keeping the writing', async () => {
    const id = await repository().create({title: 'Old'});
    await repository().update(id, {content: 'Hi', inks: [{ink: 'red', length: 2}]});

    await repository().rename(id, '  New Title  ');

    await expect(repository().get(id)).resolves.toMatchObject({title: 'New Title', titleSearchable: 'new title', content: 'Hi'});
  });

  it('deletes only the given board', async () => {
    const gone = await repository().create({title: 'Gone'});
    await repository().create({title: 'Kept'});

    await repository().delete(gone);

    await expect(repository().get(gone)).resolves.toBeNull();
    expect((await repository().list()).map((board) => board.title)).toEqual(['Kept']);
  });

  it('rejects creating a board with a blank title', async () => {
    await expect(repository().create({title: '   '})).rejects.toThrow();
    await expect(repository().list()).resolves.toEqual([]);
  });

  it('rejects renaming a board to a blank title, keeping the old one', async () => {
    const id = await repository().create({title: 'Name'});

    await expect(repository().rename(id, '   ')).rejects.toThrow();
    await expect(repository().get(id)).resolves.toMatchObject({title: 'Name'});
  });

  it('rejects renaming or deleting a board that does not exist', async () => {
    await expect(repository().rename('missing', 'Anything')).rejects.toThrow();
    await expect(repository().delete('missing')).rejects.toThrow();
  });

  it('rejects an update to a board that does not exist', async () => {
    await expect(repository().update('missing', {content: 'anything', inks: []})).rejects.toThrow();
  });

  it('rejects a save that does not fit in storage', async () => {
    const id = await repository().create({title: 'Big'});
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    await expect(repository().update(id, {content: 'x', inks: []})).rejects.toThrow('Quota exceeded');
    setItem.mockRestore();
  });

  it('reads colors that do not fit the text as the default ink', async () => {
    const id = await repository().create({title: 'Odd'});
    const stored = JSON.parse(localStorage.getItem(BOARDS_KEY) ?? '[]') as Array<Record<string, unknown>>;
    stored[0] = {...stored[0], content: 'Hi', inks: []};
    localStorage.setItem(BOARDS_KEY, JSON.stringify(stored));

    await expect(repository().get(id)).resolves.toMatchObject({inks: [{ink: 'blue', length: 2}]});
  });
});
