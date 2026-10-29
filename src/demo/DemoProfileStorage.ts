/** The demo visitor, remembered in this browser between visits. */
export interface DemoProfile {
  displayName: string;
  /** Whether the visitor is in demo mode now. Signing out clears it but keeps the name. */
  active: boolean;
}

const PROFILE_KEY = 'whiteboard.demo.profile';

function isDemoProfile(value: unknown): value is DemoProfile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const profile = value as Record<string, unknown>;

  return typeof profile.displayName === 'string' && profile.displayName.trim() !== '' && typeof profile.active === 'boolean';
}

/** Keeps the demo profile in web storage. */
export class DemoProfileStorage {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  /** The saved profile, or `null` if there is none or it cannot be read. */
  load(): DemoProfile | null {
    try {
      const profile: unknown = JSON.parse(this.storage.getItem(PROFILE_KEY) ?? 'null');

      return isDemoProfile(profile) ? profile : null;
    } catch {
      return null;
    }
  }

  save(profile: DemoProfile): void {
    this.storage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
}
