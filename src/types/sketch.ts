import type {MarkerInk} from '@/constants/markers';

/** A point on a board's writing surface, in surface pixels (see `BOARD_SURFACE_WIDTH`), with pen pressure from 0 to 1. */
export type StrokePoint = [x: number, y: number, pressure: number];

/** One pen stroke of a sketch, drawn over a board's writing. */
export interface Stroke {
  id: string;
  ink: MarkerInk;
  /** Drawn with a pen, whose pressure shapes the line; mouse and finger strokes simulate pressure from speed. */
  pen: boolean;
  points: StrokePoint[];
  /** When it was drawn, in epoch ms, which orders strokes so later ones are drawn on top. */
  drawnAt: number;
}
