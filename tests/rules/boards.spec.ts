import type {RulesTestContext, RulesTestEnvironment} from '@firebase/rules-unit-testing';
import type {Firestore} from 'firebase/firestore';

import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

const OWNER = 'alice';
const OTHER = 'bob';
const BOARD_ID = 'alice-board';

let testEnv: RulesTestEnvironment;

function firestoreOf(context: RulesTestContext): Firestore {
  return context.firestore() as unknown as Firestore;
}

function db(uid: string | null): Firestore {
  return firestoreOf(uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext());
}

function selfStamp(uid: string) {
  return {uid, time: serverTimestamp()};
}

function newBoard(uid: string, title = 'My Board') {
  return {
    title,
    titleSearchable: title.toLowerCase(),
    content: '',
    createdAt: selfStamp(uid),
    updatedAt: selfStamp(uid),
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-whiteboard-app',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const stamp = {uid: OWNER, time: Timestamp.now()};
    await setDoc(doc(firestoreOf(context), 'boards', BOARD_ID), {
      title: 'Alice Board',
      titleSearchable: 'alice board',
      content: 'hello',
      createdAt: stamp,
      updatedAt: stamp,
    });
  });
});

describe('boards: read', () => {
  it('allows the owner to read their board', async () => {
    await assertSucceeds(getDoc(doc(db(OWNER), 'boards', BOARD_ID)));
  });

  it('denies other users reading the board', async () => {
    await assertFails(getDoc(doc(db(OTHER), 'boards', BOARD_ID)));
  });

  it('denies unauthenticated reads', async () => {
    await assertFails(getDoc(doc(db(null), 'boards', BOARD_ID)));
  });

  it('denies reading a board that does not exist', async () => {
    await assertFails(getDoc(doc(db(OWNER), 'boards', 'missing')));
  });

  it('allows listing boards filtered to the owner', async () => {
    await assertSucceeds(getDocs(query(collection(db(OWNER), 'boards'), where('createdAt.uid', '==', OWNER))));
  });

  it('denies unfiltered list queries', async () => {
    await assertFails(getDocs(collection(db(OWNER), 'boards')));
  });

  it('denies listing another user\'s boards', async () => {
    await assertFails(getDocs(query(collection(db(OTHER), 'boards'), where('createdAt.uid', '==', OWNER))));
  });
});

describe('boards: create', () => {
  it('allows creating a board stamped by self', async () => {
    await assertSucceeds(addDoc(collection(db(OWNER), 'boards'), newBoard(OWNER)));
  });

  it('denies creating a board on behalf of another user', async () => {
    await assertFails(addDoc(collection(db(OTHER), 'boards'), newBoard(OWNER)));
  });

  it('denies a titleSearchable that does not match the title', async () => {
    await assertFails(addDoc(collection(db(OWNER), 'boards'), {...newBoard(OWNER), titleSearchable: 'nope'}));
  });

  it('denies unauthenticated creates', async () => {
    await assertFails(addDoc(collection(db(null), 'boards'), newBoard(OWNER)));
  });
});

describe('boards: update', () => {
  it('allows the owner to update content', async () => {
    await assertSucceeds(updateDoc(doc(db(OWNER), 'boards', BOARD_ID), {
      content: 'updated',
      updatedAt: selfStamp(OWNER),
    }));
  });

  it('denies other users updating the board', async () => {
    await assertFails(updateDoc(doc(db(OTHER), 'boards', BOARD_ID), {
      content: 'hijacked',
      updatedAt: selfStamp(OTHER),
    }));
  });

  it('denies the owner changing createdAt (ownership transfer)', async () => {
    await assertFails(updateDoc(doc(db(OWNER), 'boards', BOARD_ID), {
      createdAt: selfStamp(OTHER),
      updatedAt: selfStamp(OWNER),
    }));
  });
});

describe('boards: delete', () => {
  it('allows the owner to delete their board', async () => {
    await assertSucceeds(deleteDoc(doc(db(OWNER), 'boards', BOARD_ID)));
  });

  it('denies other users deleting the board', async () => {
    await assertFails(deleteDoc(doc(db(OTHER), 'boards', BOARD_ID)));
  });
});
