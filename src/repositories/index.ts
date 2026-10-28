import type {BoardRepository} from './BoardRepository';
import type {SessionUser} from '@/types/session';

import {db} from '@/firebase';
import {FirestoreBoardRepository} from './FirestoreBoardRepository';

export type {BoardRepository} from './BoardRepository';

/**
 * Selects the board storage for a session. Demo mode will return a local implementation here.
 *
 * Callers create a repository per use rather than holding on to one, so it always matches the
 * current session. Implementations must therefore be cheap to construct and keep no state
 * between calls: anything they cache in a field is thrown away on the next call.
 */
export function createBoardRepository(user: SessionUser): BoardRepository {
  return new FirestoreBoardRepository(db, user.uid);
}
