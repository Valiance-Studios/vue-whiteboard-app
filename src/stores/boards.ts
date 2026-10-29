import type {Board, BoardUpdateInput, NewBoardInput} from '@/types/board';
import type {BoardRepository, SketchRepository} from '@/repositories';
import type {Stroke} from '@/types/sketch';
import type {SessionUser} from '@/types/session';

import {defineStore} from 'pinia';
import {createBoardRepository, createSketchRepository} from '@/repositories';
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

function currentSketchRepository(): SketchRepository {
  return createSketchRepository(currentUser());
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

    /** Renames a board and updates it in the loaded list. Errors propagate to the caller. */
    async renameBoard(id: string, title: string): Promise<void> {
      await currentRepository().rename(id, title);
      const board = this.boards.find((loaded) => loaded.id === id);

      if (board) {
        board.title = title.trim();
        board.titleSearchable = toSearchable(board.title);
      }
    },

    /** Deletes a board and drops it from the loaded list. Errors propagate to the caller. */
    async deleteBoard(id: string): Promise<void> {
      await currentRepository().delete(id);
      this.boards = this.boards.filter((board) => board.id !== id);
    },

    /** Saves what is written on a board. Errors propagate to the caller, which owns the save status. */
    async saveBoardWriting(id: string, changes: BoardUpdateInput): Promise<void> {
      await currentRepository().update(id, changes);
    },

    /** A board's strokes, oldest first. Errors propagate to the caller. */
    async getStrokes(boardId: string): Promise<Stroke[]> {
      return currentSketchRepository().list(boardId);
    },

    /** Saves a new (or restored) stroke. Errors propagate to the caller, which owns the save status. */
    async addStroke(boardId: string, stroke: Stroke): Promise<void> {
      await currentSketchRepository().add(boardId, stroke);
    },

    /** Removes a stroke. Errors propagate to the caller, which owns the save status. */
    async removeStroke(boardId: string, strokeId: string): Promise<void> {
      await currentSketchRepository().remove(boardId, strokeId);
    },
  },
});
