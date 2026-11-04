import type {RulesTestContext, RulesTestEnvironment} from '@firebase/rules-unit-testing';
import type {Firestore} from 'firebase/firestore';

import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, getDocs, setDoc} from 'firebase/firestore';

const OWNER = 'alice';
const OTHER = 'bob';
/** Signed in, but not on the allowlist. */
const STRANGER = 'mallory';

let testEnv: RulesTestEnvironment;

function firestoreOf(context: RulesTestContext): Firestore {
  return context.firestore() as unknown as Firestore;
}

function db(uid: string | null, emailVerified = true): Firestore {
  return firestoreOf(uid
    ? testEnv.authenticatedContext(uid, {email: `${uid}@example.com`, email_verified: emailVerified})
    : testEnv.unauthenticatedContext());
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
    const admin = firestoreOf(context);
    await Promise.all([OWNER, OTHER].map((uid) => setDoc(doc(admin, 'allowedUsers', `${uid}@example.com`), {})));
    await setDoc(doc(admin, 'userSettings', OTHER), {themeChoice: 'dark'});
  });
});

describe('userSettings: reading', () => {
  it('lets a user read their own settings, even before they have any', async () => {
    await assertSucceeds(getDoc(doc(db(OWNER), 'userSettings', OWNER)));
    await assertSucceeds(getDoc(doc(db(OTHER), 'userSettings', OTHER)));
  });

  it('denies reading another user\'s settings', async () => {
    await assertFails(getDoc(doc(db(OWNER), 'userSettings', OTHER)));
  });

  it('denies listing settings', async () => {
    await assertFails(getDocs(collection(db(OWNER), 'userSettings')));
  });

  it('denies users outside the allowlist', async () => {
    await assertFails(getDoc(doc(db(STRANGER), 'userSettings', STRANGER)));
  });

  it('denies unauthenticated requests', async () => {
    await assertFails(getDoc(doc(db(null), 'userSettings', OWNER)));
  });
});

describe('userSettings: writing', () => {
  it('lets a user save each setting on its own', async () => {
    const ref = doc(db(OWNER), 'userSettings', OWNER);

    await assertSucceeds(setDoc(ref, {themeChoice: 'dark'}, {merge: true}));
    await assertSucceeds(setDoc(ref, {customMarkerColor: '#d81b60'}, {merge: true}));
  });

  it('denies writing another user\'s settings', async () => {
    await assertFails(setDoc(doc(db(OWNER), 'userSettings', OTHER), {themeChoice: 'light'}, {merge: true}));
  });

  it('denies users outside the allowlist', async () => {
    await assertFails(setDoc(doc(db(STRANGER), 'userSettings', STRANGER), {themeChoice: 'dark'}));
  });

  it('denies an unverified email', async () => {
    await assertFails(setDoc(doc(db(OWNER, false), 'userSettings', OWNER), {themeChoice: 'dark'}));
  });

  it('denies unknown fields', async () => {
    await assertFails(setDoc(doc(db(OWNER), 'userSettings', OWNER), {isAdmin: true}));
  });

  it('denies an unknown theme', async () => {
    await assertFails(setDoc(doc(db(OWNER), 'userSettings', OWNER), {themeChoice: 'sepia'}));
  });

  it.each(['#D81B60', '#abc', 'red', '#d81b60;', 7])('denies the marker color %s', async (customMarkerColor) => {
    await assertFails(setDoc(doc(db(OWNER), 'userSettings', OWNER), {customMarkerColor}));
  });

  it('denies deleting settings', async () => {
    await assertFails(deleteDoc(doc(db(OTHER), 'userSettings', OTHER)));
  });
});
