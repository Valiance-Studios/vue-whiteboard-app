import type {Board} from '@/types/board';

/** What the board collection can be sorted by. */
export enum BoardSortField {
  Title = 'title',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}

export enum SortDirection {
  Ascending = 'asc',
  Descending = 'desc',
}

export interface BoardSort {
  field: BoardSortField;
  direction: SortDirection;
}

/** Most recently updated first. */
export const DEFAULT_BOARD_SORT: Readonly<BoardSort> = {field: BoardSortField.UpdatedAt, direction: SortDirection.Descending};

const titleCollator = new Intl.Collator(undefined, {sensitivity: 'base', numeric: true});

/** Case-insensitive and numeric-aware, so "Sprint 9" comes before "Sprint 10". */
function compareTitles(a: Board, b: Board): number {
  return titleCollator.compare(a.title, b.title);
}

/** Each field's comparison in ascending order. */
const ASCENDING_COMPARATORS: Record<BoardSortField, (a: Board, b: Board) => number> = {
  [BoardSortField.Title]: compareTitles,
  [BoardSortField.CreatedAt]: (a, b) => a.createdAt.time.getTime() - b.createdAt.time.getTime(),
  [BoardSortField.UpdatedAt]: (a, b) => a.updatedAt.time.getTime() - b.updatedAt.time.getTime(),
};

/**
 * A copy of `boards` in the given order. Ties (e.g. demo mode's seed boards, created and updated at the same moment)
 * fall back to the title in ascending order, and then to the board's id so the order is stable.
 */
export function sortBoards(boards: readonly Board[], {field, direction}: BoardSort): Board[] {
  const sign = direction === SortDirection.Ascending ? 1 : -1;
  const compare = ASCENDING_COMPARATORS[field];

  return [...boards].sort((a, b) => sign * compare(a, b) || compareTitles(a, b) || a.id.localeCompare(b.id));
}
