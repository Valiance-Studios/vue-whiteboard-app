import type {Board, NewBoardInput} from '@/types/board';

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
}
