import {describe, expect, it, vi} from 'vitest';
import {createBoardRepository} from '@/repositories';
import {FirestoreBoardRepository} from '@/repositories/FirestoreBoardRepository';
import {LocalStorageBoardRepository} from '@/repositories/LocalStorageBoardRepository';

vi.mock('@/firebase', () => ({db: {}}));

describe('createBoardRepository', () => {
  it('keeps demo boards in this browser', () => {
    const repository = createBoardRepository({uid: 'demo', kind: 'demo', displayName: 'Grace', email: null, photoURL: null});

    expect(repository).toBeInstanceOf(LocalStorageBoardRepository);
  });

  it('keeps Google accounts\' boards in Firestore', () => {
    const repository = createBoardRepository({uid: 'u1', kind: 'google', displayName: 'Ada', email: 'ada@example.com', photoURL: null});

    expect(repository).toBeInstanceOf(FirestoreBoardRepository);
  });
});
