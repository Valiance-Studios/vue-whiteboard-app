import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import type {Board} from '@/types/board';
import type {Firestore} from 'firebase/firestore';

import {readFileSync} from 'node:fs';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc, setDoc, updateDoc} from 'firebase/firestore';
import {FirestoreBoardRepository} from '@/repositories/FirestoreBoardRepository';
import {BOARD_MIN_SAVE_INTERVAL_MS} from '@/constants/board';

// Runs against the Firestore emulator with security rules enforced, so it also
// verifies that the repository's queries are ones the rules allow.

const OWNER = 'alice';
const OTHER = 'bob';

let testEnv: RulesTestEnvironment;

function emailOf(uid: string): string {
  return `${uid}@example.com`;
}

function repositoryFor(uid: string): FirestoreBoardRepository {
  const context = testEnv.authenticatedContext(uid, {email: emailOf(uid), email_verified: true});

  return new FirestoreBoardRepository(context.firestore() as unknown as Firestore, uid);
}

/** Waits out the rules' minimum gap between writes to one board. */
function waitForSaveInterval(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, BOARD_MIN_SAVE_INTERVAL_MS + 100);
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
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await Promise.all([OWNER, OTHER].map((uid) => setDoc(doc(db, 'allowedUsers', emailOf(uid)), {})));
  });
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

      await repository.update(id, {content: 'Ship the editor', inks: [], hasSketches: false});
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

      await repository.update(id, {content: 'first', inks: [], hasSketches: false});
      await waitForSaveInterval();
      await repository.update(id, {content: 'second', inks: [], hasSketches: false});

      await expect(repository.get(id)).resolves.toMatchObject({content: 'second'});
    });

    it('saves whether the board has sketches', async () => {
      const repository = repositoryFor(OWNER);
      const id = await repository.create({title: 'Sketched'});
      await expect(repository.get(id)).resolves.toMatchObject({hasSketches: false});

      await repository.update(id, {content: '', inks: [], hasSketches: true});

      await expect(repository.get(id)).resolves.toMatchObject({hasSketches: true});
    });

    it('saves and reads back marker colors', async () => {
      const repository = repositoryFor(OWNER);
      const id = await repository.create({title: 'Colors'});
      const inks = [{ink: 'blue' as const, length: 6}, {ink: 'red' as const, length: 5}];

      await repository.update(id, {content: 'Hello world', inks, hasSketches: false});

      await expect(repository.get(id)).resolves.toMatchObject({content: 'Hello world', inks, hasSketches: false});
    });

    it('reads a board saved without marker colors in the default ink', async () => {
      const repository = repositoryFor(OWNER);
      const id = await repository.create({title: 'Plain'});
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore() as unknown as Firestore, 'boards', id), {content: 'Milk'});
      });

      await expect(repository.get(id)).resolves.toMatchObject({content: 'Milk', inks: [{ink: 'blue', length: 4}], hasSketches: false});
    });

    it('rejects an update to another user\'s board', async () => {
      const id = await repositoryFor(OTHER).create({title: 'Bob Board'});

      await expect(repositoryFor(OWNER).update(id, {content: 'mine now', inks: [], hasSketches: false})).rejects.toThrow();
      await expect(repositoryFor(OTHER).get(id)).resolves.toMatchObject({content: ''});
    });

    it('rejects an update to a board that does not exist', async () => {
      await expect(repositoryFor(OWNER).update('missing', {content: 'anything', inks: [], hasSketches: false})).rejects.toThrow();
    });
  });

  describe('rename', () => {
    it('gives the board a trimmed title and searchable title, keeping its writing', async () => {
      const repository = repositoryFor(OWNER);
      const id = await repository.create({title: 'Old Name'});
      await repository.update(id, {content: 'Keep me', inks: [], hasSketches: false});
      await waitForSaveInterval();

      await repository.rename(id, '  New Name  ');

      await expect(repository.get(id)).resolves.toMatchObject({title: 'New Name', titleSearchable: 'new name', content: 'Keep me'});
    });

    it('rejects a blank title', async () => {
      const repository = repositoryFor(OWNER);
      const id = await repository.create({title: 'Name'});

      await expect(repository.rename(id, '   ')).rejects.toThrow();
    });

    it('rejects renaming another user\'s board', async () => {
      const id = await repositoryFor(OTHER).create({title: 'Bob Board'});

      await expect(repositoryFor(OWNER).rename(id, 'Mine now')).rejects.toThrow();
      await expect(repositoryFor(OTHER).get(id)).resolves.toMatchObject({title: 'Bob Board'});
    });
  });

  describe('delete', () => {
    it('deletes the board', async () => {
      const repository = repositoryFor(OWNER);
      const id = await repository.create({title: 'Gone'});

      await repository.delete(id);

      await expect(repository.get(id)).resolves.toBeNull();
    });

    it('rejects deleting another user\'s board', async () => {
      const id = await repositoryFor(OTHER).create({title: 'Bob Board'});

      await expect(repositoryFor(OWNER).delete(id)).rejects.toThrow();
      await expect(repositoryFor(OTHER).get(id)).resolves.toMatchObject({title: 'Bob Board'});
    });

    it('rejects deleting a board that does not exist', async () => {
      await expect(repositoryFor(OWNER).delete('missing')).rejects.toThrow();
    });
  });
});
