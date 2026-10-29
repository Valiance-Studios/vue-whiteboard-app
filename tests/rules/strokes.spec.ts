import type {RulesTestContext, RulesTestEnvironment} from '@firebase/rules-unit-testing';
import type {Firestore} from 'firebase/firestore';

import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, Timestamp, updateDoc, where} from 'firebase/firestore';

const OWNER = 'alice';
const OTHER = 'bob';
const BOARD_ID = 'alice-board';
const STROKE_PATH = ['boards', BOARD_ID, 'strokes'] as const;

let testEnv: RulesTestEnvironment;

function firestoreOf(context: RulesTestContext): Firestore {
  return context.firestore() as unknown as Firestore;
}

function db(uid: string): Firestore {
  return firestoreOf(testEnv.authenticatedContext(uid, {email: `${uid}@example.com`, email_verified: true}));
}

function stroke(ownerUid = OWNER) {
  return {ownerUid, ink: 'red', pen: false, points: '20,20,50,2,-1,0', drawnAt: 1_000};
}

function strokeDoc(firestore: Firestore, id = 's1') {
  return doc(firestore, ...STROKE_PATH, id);
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
    const admin = firestoreOf(context);
    await Promise.all([OWNER, OTHER].map((uid) => setDoc(doc(admin, 'allowedUsers', `${uid}@example.com`), {})));
    const stamp = {uid: OWNER, time: Timestamp.now()};
    await setDoc(doc(admin, 'boards', BOARD_ID), {title: 'Alice Board', titleSearchable: 'alice board', content: '', createdAt: stamp, updatedAt: stamp});
  });
});

/** Seeds Alice's stroke `s1` on her board. */
async function seedStroke(): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(strokeDoc(firestoreOf(context)), stroke());
  });
}

describe('strokes: create', () => {
  it('lets the board\'s owner add a stroke', async () => {
    await assertSucceeds(setDoc(strokeDoc(db(OWNER)), stroke()));
  });

  it('denies adding a stroke to someone else\'s board', async () => {
    await assertFails(setDoc(strokeDoc(db(OTHER)), stroke(OTHER)));
  });

  it('denies a stroke on a board that does not exist', async () => {
    await assertFails(setDoc(doc(db(OWNER), 'boards', 'missing', 'strokes', 's1'), stroke()));
  });

  it('denies a stroke owned by someone else', async () => {
    await assertFails(setDoc(strokeDoc(db(OWNER)), stroke(OTHER)));
  });

  it.each([
    ['an unknown ink', {ink: 'pink'}],
    ['a pen flag that is not a boolean', {pen: 'yes'}],
    ['points that are not numbers', {points: '1,2,x'}],
    ['points that are not a string', {points: [1, 2, 3]}],
    ['a drawing time that is not a whole number', {drawnAt: 1.5}],
    ['an extra field', {color: '#ff0000'}],
  ])('denies %s', async (_case, change) => {
    await assertFails(setDoc(strokeDoc(db(OWNER)), {...stroke(), ...change}));
  });

  it('denies points over the maximum length', async () => {
    const points = Array.from({length: 12_000}, () => '1').join(',');

    await assertFails(setDoc(strokeDoc(db(OWNER)), {...stroke(), points}));
  });
});

describe('strokes: read, edit and delete', () => {
  beforeEach(async () => {
    await seedStroke();
  });

  it('lets the owner read and list their strokes', async () => {
    await assertSucceeds(getDoc(strokeDoc(db(OWNER))));
    await assertSucceeds(getDocs(query(collection(db(OWNER), ...STROKE_PATH), where('ownerUid', '==', OWNER))));
  });

  it('denies reading someone else\'s strokes', async () => {
    await assertFails(getDoc(strokeDoc(db(OTHER))));
  });

  it('denies listing strokes without the owner filter', async () => {
    await assertFails(getDocs(collection(db(OWNER), ...STROKE_PATH)));
  });

  it('denies editing a stroke, which is only ever added and removed', async () => {
    await assertFails(updateDoc(strokeDoc(db(OWNER)), {ink: 'blue'}));
  });

  it('lets the owner delete a stroke, but nobody else', async () => {
    await assertFails(deleteDoc(strokeDoc(db(OTHER))));
    await assertSucceeds(deleteDoc(strokeDoc(db(OWNER))));
  });

  it('denies an owner who has been removed from the allowlist', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(firestoreOf(context), 'allowedUsers', `${OWNER}@example.com`));
    });

    await assertFails(getDoc(strokeDoc(db(OWNER))));
  });
});
