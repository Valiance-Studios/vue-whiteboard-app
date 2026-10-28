import type {AuditStamp, Board, NewBoardInput} from '@/types/board';
import type {BoardRepository} from './BoardRepository';
import type {DocumentSnapshot, Firestore, Timestamp} from 'firebase/firestore';

import {FirebaseError} from 'firebase/app';
import {addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where} from 'firebase/firestore';
import {toSearchable} from '@/utils/search';

const BOARDS_COLLECTION = 'boards';

interface AuditStampDocument {
  uid: string;
  time: Timestamp;
}

interface BoardDocument {
  title: string;
  titleSearchable: string;
  content: string;
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
    const stamp = {uid: this.uid, time: serverTimestamp()};

    const ref = await addDoc(collection(this.db, BOARDS_COLLECTION), {
      title,
      titleSearchable: toSearchable(title),
      content: '',
      createdAt: stamp,
      updatedAt: stamp,
    });

    return ref.id;
  }
}
