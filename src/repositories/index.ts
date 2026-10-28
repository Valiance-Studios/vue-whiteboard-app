import type {BoardRepository} from './BoardRepository';
import type {SessionUser} from '@/types/session';

import {db} from '@/firebase';
import {FirestoreBoardRepository} from './FirestoreBoardRepository';

export type {BoardRepository} from './BoardRepository';

/** Selects the board storage for a session. Demo mode will return a local implementation here. */
export function createBoardRepository(user: SessionUser): BoardRepository {
  return new FirestoreBoardRepository(db, user.uid);
}
