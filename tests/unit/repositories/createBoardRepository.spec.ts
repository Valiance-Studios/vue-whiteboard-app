import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SAMPLE_BOARDS} from '@/demo/sampleBoards';
import {createBoardRepository} from '@/repositories';
import {FirestoreBoardRepository} from '@/repositories/FirestoreBoardRepository';
import {LocalStorageBoardRepository} from '@/repositories/LocalStorageBoardRepository';

vi.mock('@/firebase', () => ({db: {}}));

describe('createBoardRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps demo boards in this browser', () => {
    const repository = createBoardRepository({uid: 'demo', kind: 'demo', displayName: 'Grace', email: null, photoURL: null});

    expect(repository).toBeInstanceOf(LocalStorageBoardRepository);
  });

  it('starts a new demo visitor with the sample boards', async () => {
    const repository = createBoardRepository({uid: 'demo', kind: 'demo', displayName: 'Grace', email: null, photoURL: null});

    expect((await repository.list()).map((board) => board.title)).toEqual(SAMPLE_BOARDS.map((board) => board.title));
  });

  it('keeps Google accounts\' boards in Firestore', () => {
    const repository = createBoardRepository({uid: 'u1', kind: 'google', displayName: 'Ada', email: 'ada@example.com', photoURL: null});

    expect(repository).toBeInstanceOf(FirestoreBoardRepository);
  });
});
