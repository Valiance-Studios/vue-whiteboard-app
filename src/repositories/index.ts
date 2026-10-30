import type {BoardRepository} from './BoardRepository';
import type {SessionUser} from '@/types/session';

import {db} from '@/firebase';
import {SAMPLE_BOARDS} from '@/demo/sampleBoards';
import {FirestoreBoardRepository} from './FirestoreBoardRepository';
import {LocalStorageBoardRepository} from './LocalStorageBoardRepository';

export type {BoardRepository} from './BoardRepository';

/**
 * Selects the board storage for a session: Firestore for Google accounts, this browser for demo mode
 * (starting with the sample boards).
 *
 * Callers create a repository per use rather than holding on to one, so it always matches the
 * current session. Implementations must therefore be cheap to construct and keep no state
 * between calls: anything they cache in a field is thrown away on the next call.
 */
export function createBoardRepository(user: SessionUser): BoardRepository {
  return user.kind === 'demo'
    ? new LocalStorageBoardRepository(localStorage, user.uid, SAMPLE_BOARDS)
    : new FirestoreBoardRepository(db, user.uid);
}
