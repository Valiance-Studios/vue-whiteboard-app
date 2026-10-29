import type {BoardRepository} from './BoardRepository';
import type {SketchRepository} from './SketchRepository';
import type {SessionUser} from '@/types/session';

import {db} from '@/firebase';
import {FirestoreBoardRepository} from './FirestoreBoardRepository';
import {FirestoreSketchRepository} from './FirestoreSketchRepository';
import {LocalStorageBoardRepository} from './LocalStorageBoardRepository';
import {LocalStorageSketchRepository} from './LocalStorageSketchRepository';

export type {BoardRepository} from './BoardRepository';
export type {SketchRepository} from './SketchRepository';

/**
 * Selects the board storage for a session: Firestore for Google accounts, this browser for demo mode.
 *
 * Callers create a repository per use rather than holding on to one, so it always matches the
 * current session. Implementations must therefore be cheap to construct and keep no state
 * between calls: anything they cache in a field is thrown away on the next call.
 */
export function createBoardRepository(user: SessionUser): BoardRepository {
  return user.kind === 'demo'
    ? new LocalStorageBoardRepository(localStorage, user.uid)
    : new FirestoreBoardRepository(db, user.uid);
}

/** Selects where a session's strokes are kept, alongside its boards. Built per use, like `createBoardRepository`. */
export function createSketchRepository(user: SessionUser): SketchRepository {
  return user.kind === 'demo'
    ? new LocalStorageSketchRepository(localStorage)
    : new FirestoreSketchRepository(db, user.uid);
}
