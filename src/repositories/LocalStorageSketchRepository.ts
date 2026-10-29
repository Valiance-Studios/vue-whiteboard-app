import type {Stroke} from '@/types/sketch';
import type {SketchRepository} from './SketchRepository';

import {DEFAULT_INK, isMarkerInk} from '@/constants/markers';
import {decodePoints, encodePoints} from '@/utils/strokes';

/** Each demo board's strokes are kept under their own key, so saving one stroke does not rewrite every board. */
const STROKES_KEY_PREFIX = 'whiteboard.demo.strokes.';

interface StoredStroke {
  id: string;
  ink: string;
  pen: boolean;
  /** Encoded by `encodePoints`, which is far smaller than JSON arrays of numbers. */
  points: string;
  drawnAt: number;
}

function strokesKey(boardId: string): string {
  return `${STROKES_KEY_PREFIX}${boardId}`;
}

/** Deletes a demo board's strokes. */
export function clearDemoStrokes(storage: Storage, boardId: string): void {
  storage.removeItem(strokesKey(boardId));
}

/** Deletes the strokes of every demo board, e.g. when someone new starts demo mode in the same browser. */
export function clearAllDemoStrokes(storage: Storage): void {
  const keys = Array.from({length: storage.length}, (_, i) => storage.key(i))
    .filter((key): key is string => key?.startsWith(STROKES_KEY_PREFIX) ?? false);

  for (const key of keys) {
    storage.removeItem(key);
  }
}

/** Keeps demo mode's strokes in web storage. Like `LocalStorageBoardRepository`, it reads and writes on every call. */
export class LocalStorageSketchRepository implements SketchRepository {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  private read(boardId: string): StoredStroke[] {
    const strokes: unknown = JSON.parse(this.storage.getItem(strokesKey(boardId)) ?? '[]');

    return Array.isArray(strokes) ? strokes as StoredStroke[] : [];
  }

  /** Throws if storage is full, which surfaces as a failed save. */
  private write(boardId: string, strokes: StoredStroke[]): void {
    this.storage.setItem(strokesKey(boardId), JSON.stringify(strokes));
  }

  // Async like the interface, so storage errors (e.g. a full quota) reject rather than throw.
  async list(boardId: string): Promise<Stroke[]> {
    return this.read(boardId)
      .map((stored) => ({
        id: stored.id,
        ink: isMarkerInk(stored.ink) ? stored.ink : DEFAULT_INK,
        pen: stored.pen,
        points: decodePoints(stored.points),
        drawnAt: stored.drawnAt,
      }))
      .sort((a, b) => a.drawnAt - b.drawnAt);
  }

  async add(boardId: string, stroke: Stroke): Promise<void> {
    const strokes = this.read(boardId).filter((stored) => stored.id !== stroke.id);
    strokes.push({id: stroke.id, ink: stroke.ink, pen: stroke.pen, points: encodePoints(stroke.points), drawnAt: stroke.drawnAt});

    this.write(boardId, strokes);
  }

  async remove(boardId: string, strokeId: string): Promise<void> {
    const strokes = this.read(boardId);

    // Throws for a missing stroke, as Firestore's rules would.
    if (!strokes.some((stored) => stored.id === strokeId)) {
      throw new Error(`Stroke ${strokeId} does not exist.`);
    }

    this.write(boardId, strokes.filter((stored) => stored.id !== strokeId));
  }
}
