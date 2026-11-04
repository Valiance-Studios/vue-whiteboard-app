import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import type {Firestore} from 'firebase/firestore';

import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc, setDoc} from 'firebase/firestore';
import {FirestoreUserSettingsRepository} from '@/repositories/FirestoreUserSettingsRepository';

// Runs against the Firestore emulator with security rules enforced, so the writes are ones the rules allow.

const OWNER = 'alice';

let testEnv: RulesTestEnvironment;

function repository(): FirestoreUserSettingsRepository {
  const context = testEnv.authenticatedContext(OWNER, {email: `${OWNER}@example.com`, email_verified: true});

  return new FirestoreUserSettingsRepository(context.firestore() as unknown as Firestore, OWNER);
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
    await setDoc(doc(context.firestore() as unknown as Firestore, 'allowedUsers', `${OWNER}@example.com`), {});
  });
});

describe('FirestoreUserSettingsRepository', () => {
  it('has no settings for a user who has not saved any', async () => {
    await expect(repository().load()).resolves.toEqual({});
  });

  it('saves each setting without touching the other', async () => {
    await repository().save({themeChoice: 'dark'});
    await repository().save({customMarkerColor: '#d81b60'});
    await repository().save({themeChoice: 'light'});

    await expect(repository().load()).resolves.toEqual({themeChoice: 'light', customMarkerColor: '#d81b60'});
  });

  it('ignores invalid stored values', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, 'userSettings', OWNER), {themeChoice: 'sepia', customMarkerColor: 'pink'});
    });

    await expect(repository().load()).resolves.toEqual({});
  });
});
