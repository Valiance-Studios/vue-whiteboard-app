import type {Board, NewBoardInput} from '@/types/board';
import type {BoardRepository} from '@/repositories';

import {defineStore} from 'pinia';
import {createBoardRepository} from '@/repositories';
import {useAuthStore} from './auth';

interface BoardsState {
  boards: Board[];
  /** The term the current `boards` were searched with. */
  searchTerm: string;
  loading: boolean;
  error: string | null;
}

/** Incremented per search so that only the latest of overlapping searches updates state. */
let latestSearchId = 0;

function currentRepository(): BoardRepository {
  const authStore = useAuthStore();

  if (!authStore.user) {
    throw new Error('Cannot access boards without a session.');
  }

  return createBoardRepository(authStore.user);
}

export const useBoardsStore = defineStore('boards', {
  state: (): BoardsState => ({
    boards: [],
    searchTerm: '',
    loading: false,
    error: null,
  }),

  actions: {
    async search(term: string): Promise<void> {
      const searchId = ++latestSearchId;
      this.loading = true;
      this.error = null;

      try {
        const boards = await currentRepository().search(term);

        if (searchId === latestSearchId) {
          this.boards = boards;
          this.searchTerm = term;
        }
      } catch (error) {
        console.error('Failed to load boards', error);

        if (searchId === latestSearchId) {
          this.error = 'Could not load your boards. Please try again.';
        }
      } finally {
        if (searchId === latestSearchId) {
          this.loading = false;
        }
      }
    },

    /** Creates a board and returns its id. Errors propagate to the caller. */
    async createBoard(input: NewBoardInput): Promise<string> {
      return currentRepository().create(input);
    },
  },
});
