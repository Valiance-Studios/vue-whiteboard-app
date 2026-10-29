import type {MarkerInk} from '@/constants/markers';
import type {Stroke} from '@/types/sketch';
import type {SketchRepository} from './SketchRepository';
import type {Firestore} from 'firebase/firestore';

import {collection, deleteDoc, doc, getDocs, query, setDoc, where} from 'firebase/firestore';
import {DEFAULT_INK, isMarkerInk} from '@/constants/markers';
import {decodePoints, encodePoints} from '@/utils/strokes';
import {BOARDS_COLLECTION, STROKES_COLLECTION} from './firestorePaths';

interface StrokeDocument {
  /** Who drew it. Kept on the stroke so the rules can check reads and deletes without reading the board. */
  ownerUid: string;
  ink: MarkerInk;
  pen: boolean;
  /** Encoded by `encodePoints`. */
  points: string;
  drawnAt: number;
}

export class FirestoreSketchRepository implements SketchRepository {
  private readonly db: Firestore;
  private readonly uid: string;

  constructor(db: Firestore, uid: string) {
    this.db = db;
    this.uid = uid;
  }

  async list(boardId: string): Promise<Stroke[]> {
    // The owner filter is required by the rules. Sorting here avoids needing a composite index.
    const snapshot = await getDocs(query(collection(this.db, BOARDS_COLLECTION, boardId, STROKES_COLLECTION), where('ownerUid', '==', this.uid)));

    return snapshot.docs
      .map((stroke) => {
        const data = stroke.data() as StrokeDocument;

        return {
          id: stroke.id,
          ink: isMarkerInk(data.ink) ? data.ink : DEFAULT_INK,
          pen: data.pen,
          points: decodePoints(data.points),
          drawnAt: data.drawnAt,
        };
      })
      .sort((a, b) => a.drawnAt - b.drawnAt);
  }

  async add(boardId: string, stroke: Stroke): Promise<void> {
    const document: StrokeDocument = {
      ownerUid: this.uid,
      ink: stroke.ink,
      pen: stroke.pen,
      points: encodePoints(stroke.points),
      drawnAt: stroke.drawnAt,
    };

    await setDoc(doc(this.db, BOARDS_COLLECTION, boardId, STROKES_COLLECTION, stroke.id), document);
  }

  async remove(boardId: string, strokeId: string): Promise<void> {
    await deleteDoc(doc(this.db, BOARDS_COLLECTION, boardId, STROKES_COLLECTION, strokeId));
  }
}
