import type {RulesTestContext, RulesTestEnvironment} from '@firebase/rules-unit-testing';
import type {Firestore} from 'firebase/firestore';

import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp} from 'firebase/firestore';

const STRANGER = 'mallory';
const OTHER = 'bob';
const EMAIL = 'mallory@example.com';

let testEnv: RulesTestEnvironment;

function firestoreOf(context: RulesTestContext): Firestore {
  return context.firestore() as unknown as Firestore;
}

function db(uid: string | null): Firestore {
  return firestoreOf(uid ? testEnv.authenticatedContext(uid, {email: `${uid}@example.com`, email_verified: true}) : testEnv.unauthenticatedContext());
}

function request(email = EMAIL) {
  return {email, displayName: 'Mallory', requestedAt: serverTimestamp()};
}

/** Seeds Mallory's request as last made `agoMs` ago. */
async function seedRequest(agoMs: number): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(firestoreOf(context), 'accessRequests', STRANGER), {
      email: EMAIL,
      displayName: 'Mallory',
      requestedAt: Timestamp.fromMillis(Date.now() - agoMs),
    });
  });
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
});

describe('accessRequests: writing', () => {
  it('lets a signed-in user record their own request', async () => {
    await assertSucceeds(setDoc(doc(db(STRANGER), 'accessRequests', STRANGER), request()));
  });

  it('allows a request without a display name', async () => {
    await assertSucceeds(setDoc(doc(db(STRANGER), 'accessRequests', STRANGER), {...request(), displayName: null}));
  });

  it('denies recording a request for someone else', async () => {
    await assertFails(setDoc(doc(db(STRANGER), 'accessRequests', OTHER), request()));
  });

  it('denies an email other than the signed-in one', async () => {
    await assertFails(setDoc(doc(db(STRANGER), 'accessRequests', STRANGER), request('ceo@example.com')));
  });

  it('denies a time other than the server\'s', async () => {
    await assertFails(setDoc(doc(db(STRANGER), 'accessRequests', STRANGER), {...request(), requestedAt: Timestamp.fromMillis(0)}));
  });

  it('denies extra fields', async () => {
    await assertFails(setDoc(doc(db(STRANGER), 'accessRequests', STRANGER), {...request(), approved: true}));
  });

  it('denies an overlong display name', async () => {
    await assertFails(setDoc(doc(db(STRANGER), 'accessRequests', STRANGER), {...request(), displayName: 'x'.repeat(201)}));
  });

  it('denies unauthenticated requests', async () => {
    await assertFails(setDoc(doc(db(null), 'accessRequests', STRANGER), request()));
  });

  it('lets a request be repeated after a minute', async () => {
    await seedRequest(2 * 60_000);

    await assertSucceeds(setDoc(doc(db(STRANGER), 'accessRequests', STRANGER), request()));
  });

  it('denies repeating a request within a minute', async () => {
    await seedRequest(10_000);

    await assertFails(setDoc(doc(db(STRANGER), 'accessRequests', STRANGER), request()));
  });
});

describe('accessRequests: reading and deleting', () => {
  beforeEach(async () => {
    await seedRequest(2 * 60_000);
  });

  it('denies reading a request, even one\'s own', async () => {
    await assertFails(getDoc(doc(db(STRANGER), 'accessRequests', STRANGER)));
  });

  it('denies listing requests', async () => {
    await assertFails(getDocs(collection(db(STRANGER), 'accessRequests')));
  });

  it('denies deleting a request', async () => {
    await assertFails(deleteDoc(doc(db(STRANGER), 'accessRequests', STRANGER)));
  });
});
