import type {UserSettings} from '@/types/settings';
import type {UserSettingsRepository} from './UserSettingsRepository';
import type {DocumentReference, Firestore} from 'firebase/firestore';

import {doc, getDoc, setDoc} from 'firebase/firestore';
import {toUserSettings} from './UserSettingsRepository';

/** Keyed by uid. Mirrors `userSettings` in `firestore.rules`. */
const USER_SETTINGS_COLLECTION = 'userSettings';

export class FirestoreUserSettingsRepository implements UserSettingsRepository {
  private readonly db: Firestore;
  private readonly uid: string;

  constructor(db: Firestore, uid: string) {
    this.db = db;
    this.uid = uid;
  }

  private ref(): DocumentReference {
    return doc(this.db, USER_SETTINGS_COLLECTION, this.uid);
  }

  async load(): Promise<UserSettings> {
    const snapshot = await getDoc(this.ref());

    return toUserSettings(snapshot.data() ?? {});
  }

  async save(changes: UserSettings): Promise<void> {
    await setDoc(this.ref(), changes, {merge: true});
  }
}
