import type {Board} from '@/types/board';

import {describe, expect, it} from 'vitest';
import {BoardSortField, DEFAULT_BOARD_SORT, SortDirection, sortBoards} from '@/utils/boardSort';

function makeBoard(id: string, title: string, createdAt: string, updatedAt: string): Board {
  return {
    id,
    title,
    titleSearchable: title.toLowerCase(),
    content: '',
    inks: [],
    createdAt: {uid: 'u1', time: new Date(createdAt)},
    updatedAt: {uid: 'u1', time: new Date(updatedAt)},
  };
}

// Created in title order, but updated in a different order.
const BOARDS = [
  makeBoard('1', 'Sprint 10', '2026-01-03T00:00:00Z', '2026-02-01T00:00:00Z'),
  makeBoard('2', 'alpha', '2026-01-01T00:00:00Z', '2026-02-03T00:00:00Z'),
  makeBoard('3', 'Sprint 9', '2026-01-02T00:00:00Z', '2026-02-02T00:00:00Z'),
];

function titlesSortedBy(field: BoardSortField, direction: SortDirection, boards = BOARDS): string[] {
  return sortBoards(boards, {field, direction}).map((board) => board.title);
}

describe('sortBoards', () => {
  it('defaults to the most recently updated first', () => {
    expect(DEFAULT_BOARD_SORT).toEqual({field: BoardSortField.UpdatedAt, direction: SortDirection.Descending});
  });

  it('sorts by title, case-insensitive and numeric-aware', () => {
    expect(titlesSortedBy(BoardSortField.Title, SortDirection.Ascending)).toEqual(['alpha', 'Sprint 9', 'Sprint 10']);
    expect(titlesSortedBy(BoardSortField.Title, SortDirection.Descending)).toEqual(['Sprint 10', 'Sprint 9', 'alpha']);
  });

  it('sorts by created date', () => {
    expect(titlesSortedBy(BoardSortField.CreatedAt, SortDirection.Ascending)).toEqual(['alpha', 'Sprint 9', 'Sprint 10']);
    expect(titlesSortedBy(BoardSortField.CreatedAt, SortDirection.Descending)).toEqual(['Sprint 10', 'Sprint 9', 'alpha']);
  });

  it('sorts by last updated', () => {
    expect(titlesSortedBy(BoardSortField.UpdatedAt, SortDirection.Ascending)).toEqual(['Sprint 10', 'Sprint 9', 'alpha']);
    expect(titlesSortedBy(BoardSortField.UpdatedAt, SortDirection.Descending)).toEqual(['alpha', 'Sprint 9', 'Sprint 10']);
  });

  it('breaks ties by title in ascending order, whatever the direction', () => {
    const sameMoment = '2026-01-01T00:00:00Z';
    const boards = [makeBoard('1', 'Beta', sameMoment, sameMoment), makeBoard('2', 'Alpha', sameMoment, sameMoment)];

    expect(titlesSortedBy(BoardSortField.UpdatedAt, SortDirection.Descending, boards)).toEqual(['Alpha', 'Beta']);
    expect(titlesSortedBy(BoardSortField.CreatedAt, SortDirection.Ascending, boards)).toEqual(['Alpha', 'Beta']);
  });

  it('does not change the boards it is given', () => {
    const boards = [...BOARDS];
    sortBoards(boards, {field: BoardSortField.Title, direction: SortDirection.Ascending});

    expect(boards).toEqual(BOARDS);
  });
});
