import {describe, expect, it} from 'vitest';
import {findConfigProblems} from '../../../scripts/check-firebase-config.ts';

const complete = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'example',
  VITE_FIREBASE_APP_ID: 'app',
  VITE_FIREBASE_DATABASE_ID: 'db',
  VITE_APPCHECK_SITE_KEY: 'site-key',
};

describe('findConfigProblems', () => {
  it('accepts a complete config', () => {
    expect(findConfigProblems(complete, 'staging')).toEqual([]);
  });

  it('requires the App Check site key along with the Firebase config', () => {
    const [problem] = findConfigProblems({...complete, VITE_APPCHECK_SITE_KEY: '', VITE_FIREBASE_APP_ID: undefined}, 'staging');

    expect(problem).toContain('VITE_FIREBASE_APP_ID, VITE_APPCHECK_SITE_KEY');
    expect(problem).toContain('.env.staging');
  });

  it('refuses an App Check debug token, which would let anyone bypass App Check', () => {
    expect(findConfigProblems({...complete, VITE_APPCHECK_DEBUG_TOKEN: 'token'}, 'staging'))
      .toEqual([expect.stringContaining('debug token')]);
  });

  it('refuses a build pointed at the emulators', () => {
    expect(findConfigProblems({...complete, VITE_USE_FIREBASE_EMULATORS: 'true'}, 'staging'))
      .toEqual([expect.stringContaining('emulators')]);
  });
});
