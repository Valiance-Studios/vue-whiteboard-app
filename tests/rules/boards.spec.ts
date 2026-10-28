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
/** Signed in, but not on the allowlist. */
const STRANGER = 'mallory';
const BOARD_ID = 'alice-board';
const ALLOWED_USERS = [OWNER, OTHER];

/** Comfortably outside the rules' minimum gap between writes to one board. */
const LONG_AGO_MS = 60_000;

let testEnv: RulesTestEnvironment;

function firestoreOf(context: RulesTestContext): Firestore {
  return context.firestore() as unknown as Firestore;
}

function emailOf(uid: string): string {
  return `${uid}@example.com`;
}

/** A Google user whose email is verified unless stated otherwise. */
function db(uid: string | null, claims: {email?: string; email_verified?: boolean} = {}): Firestore {
  if (uid === null) {
    return firestoreOf(testEnv.unauthenticatedContext());
  }

  return firestoreOf(testEnv.authenticatedContext(uid, {email: emailOf(uid), email_verified: true, ...claims}));
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

/** Seeds Alice's board, last written `updatedAgoMs` ago. Created long ago, so it has been edited since. */
async function seedBoard(updatedAgoMs = LONG_AGO_MS): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(firestoreOf(context), 'boards', BOARD_ID), {
      title: 'Alice Board',
      titleSearchable: 'alice board',
      content: 'hello',
      createdAt: {uid: OWNER, time: Timestamp.fromMillis(Date.now() - 2 * LONG_AGO_MS)},
      updatedAt: {uid: OWNER, time: Timestamp.fromMillis(Date.now() - updatedAgoMs)},
    });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await Promise.all(ALLOWED_USERS.map((uid) => setDoc(doc(firestoreOf(context), 'allowedUsers', emailOf(uid)), {})));
  });
  await seedBoard();
});

describe('allowedUsers', () => {
  it('allows users to check their own entry', async () => {
    await assertSucceeds(getDoc(doc(db(OWNER), 'allowedUsers', emailOf(OWNER))));
  });

  it('allows a user who is not listed to find out', async () => {
    await assertSucceeds(getDoc(doc(db(STRANGER), 'allowedUsers', emailOf(STRANGER))));
  });

  it('matches the entry whatever the case of the signed-in email', async () => {
    await assertSucceeds(getDoc(doc(db(OWNER, {email: 'Alice@Example.com'}), 'allowedUsers', emailOf(OWNER))));
  });

  it('denies reading another user\'s entry', async () => {
    await assertFails(getDoc(doc(db(STRANGER), 'allowedUsers', emailOf(OWNER))));
  });

  it('denies listing the allowlist', async () => {
    await assertFails(getDocs(collection(db(OWNER), 'allowedUsers')));
  });

  it('denies adding to the allowlist', async () => {
    await assertFails(setDoc(doc(db(STRANGER), 'allowedUsers', emailOf(STRANGER)), {}));
  });

  it('denies unauthenticated reads', async () => {
    await assertFails(getDoc(doc(db(null), 'allowedUsers', emailOf(OWNER))));
  });
});

describe('boards: access', () => {
  it('denies a signed-in user who is not on the allowlist', async () => {
    await assertFails(getDocs(query(collection(db(STRANGER), 'boards'), where('createdAt.uid', '==', STRANGER))));
    await assertFails(addDoc(collection(db(STRANGER), 'boards'), newBoard(STRANGER)));
  });

  it('denies an allowlisted email that is not verified', async () => {
    await assertFails(getDoc(doc(db(OWNER, {email_verified: false}), 'boards', BOARD_ID)));
  });

  it('allows an allowlisted email in another case', async () => {
    await assertSucceeds(getDoc(doc(db(OWNER, {email: 'ALICE@example.com'}), 'boards', BOARD_ID)));
  });

  it('denies the owner once they are removed from the allowlist', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(firestoreOf(context), 'allowedUsers', emailOf(OWNER)));
    });

    await assertFails(getDoc(doc(db(OWNER), 'boards', BOARD_ID)));
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

  it('denies a blank title', async () => {
    await assertFails(addDoc(collection(db(OWNER), 'boards'), newBoard(OWNER, '   ')));
  });

  it('allows a title at the maximum length', async () => {
    await assertSucceeds(addDoc(collection(db(OWNER), 'boards'), newBoard(OWNER, 'a'.repeat(100))));
  });

  it('denies a title over the maximum length', async () => {
    await assertFails(addDoc(collection(db(OWNER), 'boards'), newBoard(OWNER, 'a'.repeat(101))));
  });

  it('allows content at the maximum length', async () => {
    await assertSucceeds(addDoc(collection(db(OWNER), 'boards'), {...newBoard(OWNER), content: 'a'.repeat(100_000)}));
  });

  it('denies content over the maximum length', async () => {
    await assertFails(addDoc(collection(db(OWNER), 'boards'), {...newBoard(OWNER), content: 'a'.repeat(100_001)}));
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

  it('denies content over the maximum length', async () => {
    await assertFails(updateDoc(doc(db(OWNER), 'boards', BOARD_ID), {
      content: 'a'.repeat(100_001),
      updatedAt: selfStamp(OWNER),
    }));
  });

  it('allows saving marker color runs', async () => {
    await assertSucceeds(updateDoc(doc(db(OWNER), 'boards', BOARD_ID), {
      content: 'hello',
      inks: 'blue:3,red:2',
      updatedAt: selfStamp(OWNER),
    }));
  });

  it('allows empty marker color runs', async () => {
    await assertSucceeds(updateDoc(doc(db(OWNER), 'boards', BOARD_ID), {content: '', inks: '', updatedAt: selfStamp(OWNER)}));
  });

  it.each([
    ['an unknown ink', 'pink:5'],
    ['a zero-length run', 'blue:0'],
    ['a missing length', 'blue'],
    ['a leading comma', ',blue:5'],
    ['a trailing comma', 'blue:5,'],
    ['other characters', 'blue:5;red:1'],
  ])('denies marker color runs with %s', async (_case, inks) => {
    await assertFails(updateDoc(doc(db(OWNER), 'boards', BOARD_ID), {content: 'hello', inks, updatedAt: selfStamp(OWNER)}));
  });

  it('denies marker color runs that are not a string', async () => {
    await assertFails(updateDoc(doc(db(OWNER), 'boards', BOARD_ID), {content: 'hello', inks: ['blue'], updatedAt: selfStamp(OWNER)}));
  });

  it('denies marker color runs over the maximum length', async () => {
    const inks = Array.from({length: 2_500}, () => 'orange:9').join(',');

    await assertFails(updateDoc(doc(db(OWNER), 'boards', BOARD_ID), {content: 'hello', inks, updatedAt: selfStamp(OWNER)}));
  });

  it('denies a write that follows the last one too closely', async () => {
    await seedBoard(0);

    await assertFails(updateDoc(doc(db(OWNER), 'boards', BOARD_ID), {
      content: 'too soon',
      updatedAt: selfStamp(OWNER),
    }));
  });

  it('allows the first edit straight after creating a board, but not a second', async () => {
    const ref = await addDoc(collection(db(OWNER), 'boards'), newBoard(OWNER));

    await assertSucceeds(updateDoc(ref, {content: 'first', updatedAt: selfStamp(OWNER)}));
    await assertFails(updateDoc(ref, {content: 'second', updatedAt: selfStamp(OWNER)}));
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
