import type {Board, BoardUpdateInput, NewBoardInput} from '@/types/board';

/**
 * Storage for the current session's boards. Implementations are scoped to a single user,
 * so callers never pass an owner and can only ever see that user's boards.
 */
export interface BoardRepository {
  /** All of the user's boards, in no particular order. */
  list(): Promise<Board[]>;

  /** The board with this id, or `null` if it does not exist or belongs to another user. */
  get(id: string): Promise<Board | null>;

  /** Creates a board and returns its id. */
  create(input: NewBoardInput): Promise<string>;

  /** Applies the changes to the board and re-stamps `updatedAt`. Fails for another user's board. */
  update(id: string, changes: BoardUpdateInput): Promise<void>;

  /** Gives the board a new title (trimmed) and re-stamps `updatedAt`. Fails like `update`. */
  rename(id: string, title: string): Promise<void>;

  /** Deletes the board. Fails for a missing board or another user's board. */
  delete(id: string): Promise<void>;
}
