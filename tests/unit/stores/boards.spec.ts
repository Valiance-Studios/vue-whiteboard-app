import type {Board} from '@/types/board';
import type {BoardRepository} from '@/repositories';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import {createBoardRepository} from '@/repositories';
import {useAuthStore} from '@/stores/auth';
import {useBoardsStore} from '@/stores/boards';

vi.mock('@/firebase', () => ({auth: {}, db: {}}));
vi.mock('@/repositories', () => ({createBoardRepository: vi.fn()}));

function makeBoard(id: string, title: string): Board {
  const stamp = {uid: 'u1', time: new Date('2026-01-01T00:00:00Z')};

  return {id, title, titleSearchable: title.toLowerCase(), content: '', createdAt: stamp, updatedAt: stamp};
}

/** A promise whose resolution is controlled by the test. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return {promise, resolve};
}

describe('boards store', () => {
  let repository: {search: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>};

  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().user = {uid: 'u1', displayName: 'Test', email: null, photoURL: null};

    repository = {search: vi.fn(), create: vi.fn()};
    vi.mocked(createBoardRepository).mockReturnValue(repository as unknown as BoardRepository);
  });

  it('stores search results and the term they belong to', async () => {
    const boards = [makeBoard('1', 'Alpha')];
    repository.search.mockResolvedValue(boards);
    const store = useBoardsStore();

    await store.search('al');

    expect(repository.search).toHaveBeenCalledWith('al');
    expect(store.boards).toEqual(boards);
    expect(store.searchTerm).toBe('al');
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('keeps only the latest results when searches overlap', async () => {
    const slow = deferred<Board[]>();
    const fast = deferred<Board[]>();
    repository.search.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const store = useBoardsStore();

    const first = store.search('a');
    const second = store.search('ab');
    fast.resolve([makeBoard('2', 'Abc')]);
    await second;
    slow.resolve([makeBoard('1', 'Apple')]);
    await first;

    expect(store.boards.map((board) => board.id)).toEqual(['2']);
    expect(store.searchTerm).toBe('ab');
    expect(store.loading).toBe(false);
  });

  it('sets an error message when the search fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    repository.search.mockRejectedValue(new Error('permission-denied'));
    const store = useBoardsStore();

    await store.search('');

    expect(store.error).toMatch(/could not load/i);
    expect(store.loading).toBe(false);
  });

  it('creates boards through the repository and returns the new id', async () => {
    repository.create.mockResolvedValue('new-id');

    await expect(useBoardsStore().createBoard({title: 'Plans'})).resolves.toBe('new-id');
    expect(repository.create).toHaveBeenCalledWith({title: 'Plans'});
  });

  it('refuses to access boards without a session', async () => {
    useAuthStore().user = null;

    await expect(useBoardsStore().createBoard({title: 'Plans'})).rejects.toThrow(/session/);
  });
});
