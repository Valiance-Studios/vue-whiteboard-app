import type {Board} from '@/types/board';
import type {BoardRepository} from '@/repositories';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import {createBoardRepository} from '@/repositories';
import {useAuthStore} from '@/stores/auth';
import {useBoardsStore} from '@/stores/boards';

vi.mock('@/firebase', () => ({auth: {}, db: {}}));
vi.mock('@/repositories', () => ({createBoardRepository: vi.fn()}));

const SESSION_USER = {uid: 'u1', displayName: 'Test', email: null, photoURL: null};

function makeBoard(id: string, title: string): Board {
  const stamp = {uid: 'u1', time: new Date('2026-01-01T00:00:00Z')};

  return {id, title, titleSearchable: title.toLowerCase(), content: '', inks: [], createdAt: stamp, updatedAt: stamp};
}

function titlesOf(boards: Board[]): string[] {
  return boards.map((board) => board.title);
}

describe('boards store', () => {
  let repository: {[method in keyof BoardRepository]: ReturnType<typeof vi.fn>};

  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().user = {...SESSION_USER};

    repository = {list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn()};
    vi.mocked(createBoardRepository).mockReturnValue(repository as unknown as BoardRepository);
  });

  describe('load', () => {
    it('stores all of the user\'s boards', async () => {
      const boards = [makeBoard('1', 'Alpha')];
      repository.list.mockResolvedValue(boards);
      const store = useBoardsStore();

      await store.load();

      expect(store.boards).toEqual(boards);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('sets an error message when loading fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      repository.list.mockRejectedValue(new Error('permission-denied'));
      const store = useBoardsStore();

      await store.load();

      expect(store.error).toMatch(/could not load/i);
      expect(store.loading).toBe(false);
    });

    it('discards results if the session changed while loading', async () => {
      let resolveList!: (boards: Board[]) => void;
      repository.list.mockReturnValue(new Promise<Board[]>((resolve) => {
        resolveList = resolve;
      }));
      const store = useBoardsStore();

      const loading = store.load();
      useAuthStore().user = null;
      resolveList([makeBoard('1', 'Previous user board')]);
      await loading;

      expect(store.boards).toEqual([]);
    });
  });

  describe('visibleBoards', () => {
    beforeEach(() => {
      useBoardsStore().boards = [
        makeBoard('1', 'Retro Notes'),
        makeBoard('2', 'project beta'),
        makeBoard('3', 'Project Alpha'),
        makeBoard('4', 'Sprint 10'),
        makeBoard('5', 'Sprint 9'),
      ];
    });

    it('returns all boards sorted by title (case-insensitive, numeric-aware) when not searching', () => {
      expect(titlesOf(useBoardsStore().visibleBoards)).toEqual(['Project Alpha', 'project beta', 'Retro Notes', 'Sprint 9', 'Sprint 10']);
    });

    it('matches the search term anywhere in the title, ignoring case and surrounding whitespace', () => {
      const store = useBoardsStore();
      store.searchTerm = '  ALPHA ';

      expect(titlesOf(store.visibleBoards)).toEqual(['Project Alpha']);

      store.searchTerm = 'pro';

      expect(titlesOf(store.visibleBoards)).toEqual(['Project Alpha', 'project beta']);
    });

    it('treats a whitespace-only term as no search', () => {
      const store = useBoardsStore();
      store.searchTerm = '   ';

      expect(store.visibleBoards).toHaveLength(5);
    });

    it('returns no boards when nothing matches', () => {
      const store = useBoardsStore();
      store.searchTerm = 'zzz';

      expect(store.visibleBoards).toEqual([]);
    });
  });

  it('gets a single board through the repository', async () => {
    const board = makeBoard('1', 'Alpha');
    repository.get.mockResolvedValue(board);

    await expect(useBoardsStore().getBoard('1')).resolves.toBe(board);
    expect(repository.get).toHaveBeenCalledWith('1');
  });

  it('creates boards through the repository and returns the new id', async () => {
    repository.create.mockResolvedValue('new-id');

    await expect(useBoardsStore().createBoard({title: 'Plans'})).resolves.toBe('new-id');
    expect(repository.create).toHaveBeenCalledWith({title: 'Plans'});
  });

  it('saves board writing through the repository', async () => {
    const writing = {content: 'Milk, eggs', inks: [{ink: 'red' as const, length: 10}]};

    await useBoardsStore().saveBoardWriting('1', writing);

    expect(repository.update).toHaveBeenCalledWith('1', writing);
  });

  it('propagates a failed save to the caller', async () => {
    repository.update.mockRejectedValue(new Error('permission-denied'));

    await expect(useBoardsStore().saveBoardWriting('1', {content: 'Milk, eggs', inks: []})).rejects.toThrow('permission-denied');
  });

  it('refuses to access boards without a session', async () => {
    useAuthStore().user = null;

    await expect(useBoardsStore().createBoard({title: 'Plans'})).rejects.toThrow(/session/);
    await expect(useBoardsStore().load()).rejects.toThrow(/session/);
  });
});
