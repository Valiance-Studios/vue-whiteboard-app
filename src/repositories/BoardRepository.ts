import type {Board, NewBoardInput} from '@/types/board';

/**
 * Storage for the current session's boards. Implementations are scoped to a single user,
 * so callers never pass an owner and can only ever see that user's boards.
 */
export interface BoardRepository {
  /** Boards whose title starts with `term` (case-insensitive), sorted by title. An empty term returns all boards. */
  search(term: string): Promise<Board[]>;

  /** Creates a board and returns its id. */
  create(input: NewBoardInput): Promise<string>;
}
