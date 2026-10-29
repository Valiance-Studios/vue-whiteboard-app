import type {AuditStamp, Board, BoardUpdateInput, NewBoardInput} from '@/types/board';
import type {BoardRepository} from './BoardRepository';
import type {DocumentSnapshot, FieldValue, Firestore, Timestamp} from 'firebase/firestore';

import {FirebaseError} from 'firebase/app';
import {addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where} from 'firebase/firestore';
import {decodeInks, encodeInks} from '@/utils/inks';
import {toSearchable} from '@/utils/search';

const BOARDS_COLLECTION = 'boards';

interface AuditStampDocument {
  uid: string;
  time: Timestamp;
}

/** An audit stamp on its way to Firestore, before the server fills in the time. */
interface PendingAuditStamp {
  uid: string;
  time: FieldValue;
}

interface BoardDocument {
  title: string;
  titleSearchable: string;
  content: string;
  /** The marker color runs, encoded by `encodeInks`. Missing on boards that were never colored. */
  inks?: string;
  createdAt: AuditStampDocument;
  updatedAt: AuditStampDocument;
}

function toAuditStamp(stamp: AuditStampDocument): AuditStamp {
  return {uid: stamp.uid, time: stamp.time.toDate()};
}

/** Maps an existing board document to the domain type. */
function toBoard(snapshot: DocumentSnapshot): Board {
  // 'estimate' fills in pending server timestamps for locally written documents.
  const data = snapshot.data({serverTimestamps: 'estimate'}) as BoardDocument;

  return {
    id: snapshot.id,
    title: data.title,
    titleSearchable: data.titleSearchable,
    content: data.content,
    inks: decodeInks(data.inks, data.content.length),
    createdAt: toAuditStamp(data.createdAt),
    updatedAt: toAuditStamp(data.updatedAt),
  };
}

export class FirestoreBoardRepository implements BoardRepository {
  private readonly db: Firestore;
  private readonly uid: string;

  constructor(db: Firestore, uid: string) {
    this.db = db;
    this.uid = uid;
  }

  /** Stamps a write with the signed-in user and the server's time, as the rules require. */
  private selfStamp(): PendingAuditStamp {
    return {uid: this.uid, time: serverTimestamp()};
  }

  async list(): Promise<Board[]> {
    // The owner filter is required by the security rules; unfiltered queries are rejected.
    const snapshot = await getDocs(query(collection(this.db, BOARDS_COLLECTION), where('createdAt.uid', '==', this.uid)));

    return snapshot.docs.map(toBoard);
  }

  async get(id: string): Promise<Board | null> {
    try {
      const snapshot = await getDoc(doc(this.db, BOARDS_COLLECTION, id));

      return snapshot.exists() ? toBoard(snapshot) : null;
    } catch (error) {
      // The rules deny reading a missing board and another user's board alike.
      if (error instanceof FirebaseError && error.code === 'permission-denied') {
        return null;
      }

      throw error;
    }
  }

  async create(input: NewBoardInput): Promise<string> {
    const title = input.title.trim();
    const stamp = this.selfStamp();

    const ref = await addDoc(collection(this.db, BOARDS_COLLECTION), {
      title,
      titleSearchable: toSearchable(title),
      content: '',
      createdAt: stamp,
      updatedAt: stamp,
    });

    return ref.id;
  }

  async update(id: string, changes: BoardUpdateInput): Promise<void> {
    // The fields are listed explicitly: the rules reject an update that writes any other field,
    // and `createdAt` must stay untouched so the owner cannot change.
    await updateDoc(doc(this.db, BOARDS_COLLECTION, id), {
      content: changes.content,
      inks: encodeInks(changes.inks),
      updatedAt: this.selfStamp(),
    });
  }

  async rename(id: string, title: string): Promise<void> {
    const trimmed = title.trim();

    await updateDoc(doc(this.db, BOARDS_COLLECTION, id), {
      title: trimmed,
      titleSearchable: toSearchable(trimmed),
      updatedAt: this.selfStamp(),
    });
  }

  async delete(id: string): Promise<void> {
    // The rules allow deleting only an existing board of the user's own, so a missing board fails too.
    await deleteDoc(doc(this.db, BOARDS_COLLECTION, id));
  }
}
