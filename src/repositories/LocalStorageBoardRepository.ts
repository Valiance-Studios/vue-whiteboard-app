import type {AuditStamp, Board, BoardUpdateInput, InkRun, NewBoardInput} from '@/types/board';
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

/** Deletes every demo board in this storage, e.g. when someone new starts demo mode in the same browser. */
export function clearDemoBoards(storage: Storage): void {
  storage.removeItem(BOARDS_KEY);
}

function toAuditStamp(stamp: StoredAuditStamp): AuditStamp {
  return {uid: stamp.uid, time: new Date(stamp.time)};
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
 */
export class LocalStorageBoardRepository implements BoardRepository {
  private readonly storage: Storage;
  private readonly uid: string;

  constructor(storage: Storage, uid: string) {
    this.storage = storage;
    this.uid = uid;
  }

  private read(): StoredBoard[] {
    const boards: unknown = JSON.parse(this.storage.getItem(BOARDS_KEY) ?? '[]');

    return Array.isArray(boards) ? boards as StoredBoard[] : [];
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
    const title = input.title.trim();
    const stamp = this.stamp();
    const id = crypto.randomUUID();

    this.write([...this.read(), {id, title, titleSearchable: toSearchable(title), content: '', inks: [], createdAt: stamp, updatedAt: stamp}]);

    return id;
  }

  async update(id: string, changes: BoardUpdateInput): Promise<void> {
    const boards = this.read();
    const board = boards.find((stored) => stored.id === id);

    if (!board) {
      throw new Error(`Board ${id} does not exist.`);
    }

    board.content = changes.content;
    board.inks = normalizeInks(changes.inks, changes.content.length);
    board.updatedAt = this.stamp();
    this.write(boards);
  }
}
