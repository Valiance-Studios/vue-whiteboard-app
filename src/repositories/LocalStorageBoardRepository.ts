import type {AuditStamp, Board, BoardUpdateInput, InkRun, NewBoardInput, SeedBoard} from '@/types/board';
import type {BoardRepository} from './BoardRepository';

import {normalizeInks} from '@/utils/inks';
import {toSearchable} from '@/utils/search';

const BOARDS_KEY = 'whiteboard.demo.boards';

interface StoredAuditStamp {
  uid: string;
  /** ISO 8601, since JSON has no date type. */
  time: string;
}

interface StoredBoard {
  id: string;
  title: string;
  titleSearchable: string;
  content: string;
  inks: InkRun[];
  createdAt: StoredAuditStamp;
  updatedAt: StoredAuditStamp;
}

/** Deletes every demo board in this storage, e.g. when someone new starts demo mode in the same browser. The next read starts from the seed boards again. */
export function clearDemoBoards(storage: Storage): void {
  storage.removeItem(BOARDS_KEY);
}

function toAuditStamp(stamp: StoredAuditStamp): AuditStamp {
  return {uid: stamp.uid, time: new Date(stamp.time)};
}

/** The trimmed title. Throws for a blank one, as Firestore's rules would. */
function toTitle(title: string): string {
  const trimmed = title.trim();

  if (!trimmed) {
    throw new Error('A board title cannot be blank.');
  }

  return trimmed;
}

function toBoard(stored: StoredBoard): Board {
  return {
    ...stored,
    inks: normalizeInks(stored.inks, stored.content.length),
    createdAt: toAuditStamp(stored.createdAt),
    updatedAt: toAuditStamp(stored.updatedAt),
  };
}

/**
 * Keeps demo mode's boards in web storage, so they stay in this browser only.
 *
 * Every call reads and writes the whole stored list rather than caching it, as `createBoardRepository`
 * requires. Demo data belongs to one visitor, so no owner checks are needed.
 *
 * Storage that has never held boards starts with `seedBoards`, written on first read so their ids stay
 * the same from then on. Deleting every board stores an empty list, so the seed boards do not come back.
 */
export class LocalStorageBoardRepository implements BoardRepository {
  private readonly storage: Storage;
  private readonly uid: string;
  private readonly seedBoards: readonly SeedBoard[];

  constructor(storage: Storage, uid: string, seedBoards: readonly SeedBoard[] = []) {
    this.storage = storage;
    this.uid = uid;
    this.seedBoards = seedBoards;
  }

  private read(): StoredBoard[] {
    const stored = this.storage.getItem(BOARDS_KEY);

    if (stored === null) {
      return this.seed();
    }

    const boards: unknown = JSON.parse(stored);

    return Array.isArray(boards) ? boards as StoredBoard[] : [];
  }

  private seed(): StoredBoard[] {
    const boards = this.seedBoards.map((board) => this.toStoredBoard(board));

    if (boards.length > 0) {
      this.write(boards);
    }

    return boards;
  }

  private toStoredBoard(board: SeedBoard): StoredBoard {
    const title = toTitle(board.title);
    const stamp = this.stamp();

    return {
      id: crypto.randomUUID(),
      title,
      titleSearchable: toSearchable(title),
      content: board.content,
      inks: normalizeInks(board.inks, board.content.length),
      createdAt: stamp,
      updatedAt: stamp,
    };
  }

  /** Throws if storage is full, which surfaces as a failed save. */
  private write(boards: StoredBoard[]): void {
    this.storage.setItem(BOARDS_KEY, JSON.stringify(boards));
  }

  private stamp(): StoredAuditStamp {
    return {uid: this.uid, time: new Date().toISOString()};
  }

  // Async like the interface, so storage errors (e.g. a full quota) reject rather than throw.
  async list(): Promise<Board[]> {
    return this.read().map(toBoard);
  }

  async get(id: string): Promise<Board | null> {
    const stored = this.read().find((board) => board.id === id);

    return stored ? toBoard(stored) : null;
  }

  async create(input: NewBoardInput): Promise<string> {
    const board = this.toStoredBoard({title: input.title, content: '', inks: []});

    this.write([...this.read(), board]);

    return board.id;
  }

  /** The board with this id in `boards`, which writes to it change. Throws for a missing board, as Firestore would. */
  private find(boards: StoredBoard[], id: string): StoredBoard {
    const board = boards.find((stored) => stored.id === id);

    if (!board) {
      throw new Error(`Board ${id} does not exist.`);
    }

    return board;
  }

  async update(id: string, changes: BoardUpdateInput): Promise<void> {
    const boards = this.read();
    const board = this.find(boards, id);

    board.content = changes.content;
    board.inks = normalizeInks(changes.inks, changes.content.length);
    board.updatedAt = this.stamp();
    this.write(boards);
  }

  async rename(id: string, title: string): Promise<void> {
    const boards = this.read();
    const board = this.find(boards, id);
    const trimmed = toTitle(title);

    board.title = trimmed;
    board.titleSearchable = toSearchable(trimmed);
    board.updatedAt = this.stamp();
    this.write(boards);
  }

  async delete(id: string): Promise<void> {
    const boards = this.read();
    // Throws for a missing board, as Firestore's rules would.
    this.find(boards, id);

    this.write(boards.filter((board) => board.id !== id));
  }
}
