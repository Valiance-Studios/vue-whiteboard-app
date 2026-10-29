import {describe, expect, it, vi} from 'vitest';
import {createBoardRepository, createSketchRepository} from '@/repositories';
import {FirestoreBoardRepository} from '@/repositories/FirestoreBoardRepository';
import {FirestoreSketchRepository} from '@/repositories/FirestoreSketchRepository';
import {LocalStorageBoardRepository} from '@/repositories/LocalStorageBoardRepository';
import {LocalStorageSketchRepository} from '@/repositories/LocalStorageSketchRepository';

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

  it('keeps strokes beside the boards: in this browser for demo mode, in Firestore otherwise', () => {
    expect(createSketchRepository({uid: 'demo', kind: 'demo', displayName: 'Grace', email: null, photoURL: null})).toBeInstanceOf(LocalStorageSketchRepository);
    expect(createSketchRepository({uid: 'u1', kind: 'google', displayName: 'Ada', email: 'ada@example.com', photoURL: null})).toBeInstanceOf(FirestoreSketchRepository);
  });
});
