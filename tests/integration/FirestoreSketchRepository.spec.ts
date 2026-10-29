import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import type {Stroke} from '@/types/sketch';
import type {Firestore} from 'firebase/firestore';

import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, doc, getDocs, setDoc} from 'firebase/firestore';
import {FirestoreBoardRepository} from '@/repositories/FirestoreBoardRepository';
import {FirestoreSketchRepository} from '@/repositories/FirestoreSketchRepository';

// Runs against the Firestore emulator with security rules enforced, so it also checks that the
// repository's reads and writes are ones the rules allow.

const OWNER = 'alice';
const OTHER = 'bob';

let testEnv: RulesTestEnvironment;

function firestoreFor(uid: string): Firestore {
  return testEnv.authenticatedContext(uid, {email: `${uid}@example.com`, email_verified: true}).firestore() as unknown as Firestore;
}

function stroke(id: string, drawnAt: number): Stroke {
  return {id, ink: 'purple', pen: true, points: [[12.5, 40, 0.3], [20, 44.5, 0.8]], drawnAt};
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-whiteboard-app',
    firestore: {rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080},
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await Promise.all([OWNER, OTHER].map((uid) => setDoc(doc(db, 'allowedUsers', `${uid}@example.com`), {})));
  });
});

describe('FirestoreSketchRepository', () => {
  it('saves strokes and lists them oldest first, points intact', async () => {
    const boardId = await new FirestoreBoardRepository(firestoreFor(OWNER), OWNER).create({title: 'Sketchy'});
    const sketches = new FirestoreSketchRepository(firestoreFor(OWNER), OWNER);

    await sketches.add(boardId, stroke('later', 2));
    await sketches.add(boardId, stroke('earlier', 1));

    await expect(sketches.list(boardId)).resolves.toEqual([stroke('earlier', 1), stroke('later', 2)]);
  });

  it('removes a stroke, and can add it back, as undo and redo do', async () => {
    const boardId = await new FirestoreBoardRepository(firestoreFor(OWNER), OWNER).create({title: 'Sketchy'});
    const sketches = new FirestoreSketchRepository(firestoreFor(OWNER), OWNER);
    await sketches.add(boardId, stroke('a', 1));

    await sketches.remove(boardId, 'a');
    await expect(sketches.list(boardId)).resolves.toEqual([]);

    await sketches.add(boardId, stroke('a', 1));
    await expect(sketches.list(boardId)).resolves.toHaveLength(1);
  });

  it('rejects adding a stroke to another user\'s board', async () => {
    const boardId = await new FirestoreBoardRepository(firestoreFor(OTHER), OTHER).create({title: 'Bob Board'});

    await expect(new FirestoreSketchRepository(firestoreFor(OWNER), OWNER).add(boardId, stroke('a', 1))).rejects.toThrow();
  });

  it('deletes a board\'s strokes along with the board', async () => {
    const boards = new FirestoreBoardRepository(firestoreFor(OWNER), OWNER);
    const boardId = await boards.create({title: 'Short Lived'});
    const sketches = new FirestoreSketchRepository(firestoreFor(OWNER), OWNER);
    await sketches.add(boardId, stroke('a', 1));
    await sketches.add(boardId, stroke('b', 2));

    await boards.delete(boardId);

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const remaining = await getDocs(collection(context.firestore() as unknown as Firestore, 'boards', boardId, 'strokes'));
      expect(remaining.size).toBe(0);
    });
  });
});
