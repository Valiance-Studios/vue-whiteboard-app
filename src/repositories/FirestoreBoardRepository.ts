import type {AuditStamp, Board, NewBoardInput} from '@/types/board';
import type {BoardRepository} from './BoardRepository';
import type {Firestore, QueryConstraint, QueryDocumentSnapshot, Timestamp} from 'firebase/firestore';

import {addDoc, collection, getDocs, orderBy, query, serverTimestamp, where} from 'firebase/firestore';
import {toSearchable} from '@/utils/search';

const BOARDS_COLLECTION = 'boards';
/** High code point that sorts after any character a title is likely to contain; bounds a prefix range query. */
const PREFIX_RANGE_END = '';

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

function toBoard(snapshot: QueryDocumentSnapshot): Board {
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

  async search(term: string): Promise<Board[]> {
    const prefix = toSearchable(term);
    // The owner filter is required by the security rules; unfiltered queries are rejected.
    const constraints: QueryConstraint[] = [where('createdAt.uid', '==', this.uid)];

    if (prefix) {
      constraints.push(where('titleSearchable', '>=', prefix), where('titleSearchable', '<=', prefix + PREFIX_RANGE_END));
    }

    constraints.push(orderBy('titleSearchable'));

    const snapshot = await getDocs(query(collection(this.db, BOARDS_COLLECTION), ...constraints));

    return snapshot.docs.map(toBoard);
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
