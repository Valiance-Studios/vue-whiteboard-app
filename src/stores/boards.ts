import type {Board, BoardWriting, NewBoardInput} from '@/types/board';
import type {BoardRepository} from '@/repositories';
import type {SessionUser} from '@/types/session';
import type {BoardSort} from '@/utils/boardSort';

import {defineStore} from 'pinia';
import {createBoardRepository} from '@/repositories';
import {DEFAULT_BOARD_SORT, sortBoards} from '@/utils/boardSort';
import {toSearchable} from '@/utils/search';
import {useAuthStore} from './auth';

interface BoardsState {
  /** All of the user's boards, as last loaded. */
  boards: Board[];
  searchTerm: string;
  /** How the collection is ordered. Kept only in memory, so a page reload restores the default. */
  sort: BoardSort;
  loading: boolean;
  error: string | null;
}

function currentUser(): SessionUser {
  const authStore = useAuthStore();

  if (!authStore.user) {
    throw new Error('Cannot access boards without a session.');
  }

  return authStore.user;
}

function currentRepository(): BoardRepository {
  return createBoardRepository(currentUser());
}

export const useBoardsStore = defineStore('boards', {
  state: (): BoardsState => ({
    boards: [],
    searchTerm: '',
    sort: {...DEFAULT_BOARD_SORT},
    loading: false,
    error: null,
  }),

  getters: {
    /** Boards whose title contains the search term (case-insensitive), in the chosen sort order. */
    visibleBoards(state): Board[] {
      const term = toSearchable(state.searchTerm);
      const matches = term ? state.boards.filter((board) => board.titleSearchable.includes(term)) : state.boards;

      return sortBoards(matches, state.sort);
    },
  },

  actions: {
    async load(): Promise<void> {
      const user = currentUser();
      this.loading = true;
      this.error = null;

      try {
        const boards = await createBoardRepository(user).list();

        // Discard results if the session changed (e.g. sign-out) while loading.
        if (useAuthStore().user?.uid === user.uid) {
          this.boards = boards;
        }
      } catch (error) {
        console.error('Failed to load boards', error);
        this.error = 'Could not load your boards. Please try again.';
      } finally {
        this.loading = false;
      }
    },

    /** The board with this id, or `null` if it does not exist or is not the user's. Errors propagate to the caller. */
    async getBoard(id: string): Promise<Board | null> {
      return currentRepository().get(id);
    },

    /** Creates a board and returns its id. Errors propagate to the caller. */
    async createBoard(input: NewBoardInput): Promise<string> {
      return currentRepository().create(input);
    },

    /**
     * Renames a board and updates it in the loaded list, re-stamping `updatedAt` with the local time
     * as an estimate of the repository's stamp. Errors propagate to the caller.
     */
    async renameBoard(id: string, title: string): Promise<void> {
      const user = currentUser();
      await createBoardRepository(user).rename(id, title);
      const board = this.boards.find((loaded) => loaded.id === id);

      if (board) {
        board.title = title.trim();
        board.titleSearchable = toSearchable(board.title);
        board.updatedAt = {uid: user.uid, time: new Date()};
      }
    },

    /** Deletes a board and drops it from the loaded list. Errors propagate to the caller. */
    async deleteBoard(id: string): Promise<void> {
      await currentRepository().delete(id);
      this.boards = this.boards.filter((board) => board.id !== id);
    },

    /** Saves what is written on a board. Errors propagate to the caller, which owns the save status. */
    async saveBoardWriting(id: string, writing: BoardWriting): Promise<void> {
      await currentRepository().update(id, writing);
    },
  },
});
