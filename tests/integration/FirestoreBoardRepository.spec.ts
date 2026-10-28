import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import type {Board} from '@/types/board';
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
function titlesOf(boards: Board[]): string[] {
  return boards.map((board) => board.title).sort();
}

/** Fetches a board the test knows exists, so its fields can be read without null checks. */
async function existingBoard(repository: FirestoreBoardRepository, id: string): Promise<Board> {
  const board = await repository.get(id);

  if (board === null) {
    throw new Error(`Expected board ${id} to exist.`);
  }

  return board;
}

describe('FirestoreBoardRepository', () => {
  it('creates a board with a trimmed title, searchable title, and audit stamps', async () => {
    const repository = repositoryFor(OWNER);

    const id = await repository.create({title: '  Sprint Plan  '});
    const board = await repository.get(id);

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

  it('lists all of the owner\'s boards', async () => {
    const repository = repositoryFor(OWNER);
    await repository.create({title: 'Zebra'});
    await repository.create({title: 'Apple'});

    expect(titlesOf(await repository.list())).toEqual(['Apple', 'Zebra']);
  });

  it('never lists another user\'s boards', async () => {
    await repositoryFor(OTHER).create({title: 'Bob Board'});
    await repositoryFor(OWNER).create({title: 'Alice Board'});

    expect(titlesOf(await repositoryFor(OWNER).list())).toEqual(['Alice Board']);
  });

  it('returns null for a board that does not exist', async () => {
    await expect(repositoryFor(OWNER).get('missing')).resolves.toBeNull();
  });

  it('returns null for another user\'s board', async () => {
    const id = await repositoryFor(OTHER).create({title: 'Bob Board'});

    await expect(repositoryFor(OWNER).get(id)).resolves.toBeNull();
  });

  describe('update', () => {
    it('saves new content and re-stamps updatedAt, leaving createdAt alone', async () => {
      const repository = repositoryFor(OWNER);
      const id = await repository.create({title: 'Sprint Plan'});
      const created = await existingBoard(repository, id);

      await repository.update(id, {content: 'Ship the editor'});
      const updated = await existingBoard(repository, id);

      expect(updated).toMatchObject({
        title: 'Sprint Plan',
        titleSearchable: 'sprint plan',
        content: 'Ship the editor',
        createdAt: {uid: OWNER},
        updatedAt: {uid: OWNER},
      });
      expect(updated.createdAt.time).toEqual(created.createdAt.time);
      expect(updated.updatedAt.time.getTime()).toBeGreaterThanOrEqual(created.updatedAt.time.getTime());
    });

    it('saves repeated edits, keeping the last one', async () => {
      const repository = repositoryFor(OWNER);
      const id = await repository.create({title: 'Notes'});

      await repository.update(id, {content: 'first'});
      await repository.update(id, {content: 'second'});

      await expect(repository.get(id)).resolves.toMatchObject({content: 'second'});
    });

    it('rejects an update to another user\'s board', async () => {
      const id = await repositoryFor(OTHER).create({title: 'Bob Board'});

      await expect(repositoryFor(OWNER).update(id, {content: 'mine now'})).rejects.toThrow();
      await expect(repositoryFor(OTHER).get(id)).resolves.toMatchObject({content: ''});
    });

    it('rejects an update to a board that does not exist', async () => {
      await expect(repositoryFor(OWNER).update('missing', {content: 'anything'})).rejects.toThrow();
    });
  });
});
