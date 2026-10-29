import type {Stroke} from '@/types/sketch';

/**
 * Storage for the strokes sketched on the current session's boards. Strokes are only ever added and
 * removed, never edited: undoing an erase adds the same stroke back.
 */
export interface SketchRepository {
  /** The board's strokes, oldest first, so later strokes are drawn on top. */
  list(boardId: string): Promise<Stroke[]>;

  add(boardId: string, stroke: Stroke): Promise<void>;

  remove(boardId: string, strokeId: string): Promise<void>;
}
