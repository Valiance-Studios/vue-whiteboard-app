import type {Board, BoardWriting, NewBoardInput} from '@/types/board';
import type {BoardRepository} from '@/repositories';
import type {SessionUser} from '@/types/session';

import {defineStore} from 'pinia';
import {createBoardRepository} from '@/repositories';
import {toSearchable} from '@/utils/search';
import {useAuthStore} from './auth';

interface BoardsState {
  /** All of the user's boards, as last loaded. */
  boards: Board[];
  searchTerm: string;
  loading: boolean;
  error: string | null;
}

const titleCollator = new Intl.Collator(undefined, {sensitivity: 'base', numeric: true});

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
    loading: false,
    error: null,
  }),

  getters: {
    /** Boards whose title contains the search term (case-insensitive), sorted by title. */
    visibleBoards(state): Board[] {
      const term = toSearchable(state.searchTerm);
      const matches = term ? state.boards.filter((board) => board.titleSearchable.includes(term)) : state.boards;

      return [...matches].sort((a, b) => titleCollator.compare(a.title, b.title));
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

    /** Saves what is written on a board. Errors propagate to the caller, which owns the save status. */
    async saveBoardWriting(id: string, writing: BoardWriting): Promise<void> {
      await currentRepository().update(id, writing);
    },
  },
});
