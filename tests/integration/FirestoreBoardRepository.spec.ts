import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import type {Firestore} from 'firebase/firestore';

import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {FirestoreBoardRepository} from '@/repositories/FirestoreBoardRepository';

// Runs against the Firestore emulator with security rules enforced, so it also
// verifies that the repository's queries are ones the rules allow.

const OWNER = 'alice';
const OTHER = 'bob';

let testEnv: RulesTestEnvironment;

function repositoryFor(uid: string): FirestoreBoardRepository {
  return new FirestoreBoardRepository(testEnv.authenticatedContext(uid).firestore() as unknown as Firestore, uid);
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

describe('FirestoreBoardRepository', () => {
  it('creates a board with a trimmed title, searchable title, and audit stamps', async () => {
    const repository = repositoryFor(OWNER);

    const id = await repository.create({title: '  Sprint Plan  '});
    const [board] = await repository.search('');

    expect(board).toMatchObject({
      id,
      title: 'Sprint Plan',
      titleSearchable: 'sprint plan',
      content: '',
      createdAt: {uid: OWNER},
      updatedAt: {uid: OWNER},
    });
    expect(board?.createdAt.time).toBeInstanceOf(Date);
  });

  it('lists all of the owner\'s boards sorted by title', async () => {
    const repository = repositoryFor(OWNER);
    await repository.create({title: 'Zebra'});
    await repository.create({title: 'apple'});
    await repository.create({title: 'Mango'});

    const titles = (await repository.search('')).map((board) => board.title);

    expect(titles).toEqual(['apple', 'Mango', 'Zebra']);
  });

  it('matches boards by case-insensitive title prefix', async () => {
    const repository = repositoryFor(OWNER);
    await repository.create({title: 'Project Alpha'});
    await repository.create({title: 'project beta'});
    await repository.create({title: 'Retro'});

    const titles = (await repository.search('  PROJ ')).map((board) => board.title);

    expect(titles).toEqual(['Project Alpha', 'project beta']);
  });

  it('never returns another user\'s boards', async () => {
    await repositoryFor(OTHER).create({title: 'Bob Board'});
    await repositoryFor(OWNER).create({title: 'Alice Board'});

    const titles = (await repositoryFor(OWNER).search('')).map((board) => board.title);

    expect(titles).toEqual(['Alice Board']);
  });
});
