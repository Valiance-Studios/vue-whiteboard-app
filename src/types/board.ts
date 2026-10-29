import type {MarkerInk} from '@/constants/markers';

/** Who made a change and when. Storage-agnostic (uses `Date`, not a Firestore `Timestamp`). */
export interface AuditStamp {
  uid: string;
  time: Date;
}

/** A stretch of `length` characters written in one marker color. */
export interface InkRun {
  ink: MarkerInk;
  length: number;
}

/** What is written on a board: the plain text, and the marker color of every character in it. */
export interface BoardWriting {
  content: string;
  /** Consecutive runs covering `content` exactly, with no empty runs and no two neighbours of the same ink. */
  inks: InkRun[];
}

/** A whiteboard as used by the application layer. */
export interface Board extends BoardWriting {
  /** Whether anything is sketched on the board, so the collection can mark it without loading the strokes. */
  hasSketches: boolean;
  id: string;
  title: string;
  /** Lowercase copy of `title`, used for prefix search. */
  titleSearchable: string;
  createdAt: AuditStamp;
  updatedAt: AuditStamp;
}

/** User-supplied fields for creating a board. */
export interface NewBoardInput {
  title: string;
}

/** User-supplied fields for updating an existing board. The strokes themselves are saved separately. */
export interface BoardUpdateInput extends BoardWriting {
  hasSketches: boolean;
}
