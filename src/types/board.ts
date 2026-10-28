/** Who made a change and when. Storage-agnostic (uses `Date`, not a Firestore `Timestamp`). */
export interface AuditStamp {
  uid: string;
  time: Date;
}

/** A whiteboard as used by the application layer. */
export interface Board {
  id: string;
  title: string;
  /** Lowercase copy of `title`, used for prefix search. */
  titleSearchable: string;
  content: string;
  createdAt: AuditStamp;
  updatedAt: AuditStamp;
}

/** User-supplied fields for creating a board. */
export interface NewBoardInput {
  title: string;
}

/** User-supplied fields for updating an existing board. */
export interface BoardUpdateInput {
  content: string;
}
