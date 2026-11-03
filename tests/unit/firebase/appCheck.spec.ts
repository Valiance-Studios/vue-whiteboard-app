import type {FirebaseApp} from 'firebase/app';

import {afterEach, describe, expect, it, vi} from 'vitest';
import {activateAppCheck} from '@/firebase/appCheck';

const appCheck = vi.hoisted(() => ({
  initializeAppCheck: vi.fn(() => ({})),
  ReCaptchaEnterpriseProvider: vi.fn(function (this: {siteKey: string}, siteKey: string) {
    this.siteKey = siteKey;
  }),
}));

vi.mock('firebase/app-check', () => appCheck);

const app = {} as FirebaseApp;

describe('activateAppCheck', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete self.FIREBASE_APPCHECK_DEBUG_TOKEN;
  });

  it('uses reCAPTCHA Enterprise with the site key and keeps tokens fresh', () => {
    activateAppCheck(app, {siteKey: 'site-key'});

    expect(appCheck.ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('site-key');
    expect(appCheck.initializeAppCheck).toHaveBeenCalledWith(app, {
      provider: expect.objectContaining({siteKey: 'site-key'}),
      isTokenAutoRefreshEnabled: true,
    });
    expect(self.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });

  it('sets a debug token before starting App Check', () => {
    appCheck.initializeAppCheck.mockImplementationOnce(() => {
      expect(self.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe('debug-token');

      return {};
    });

    activateAppCheck(app, {siteKey: 'site-key', debugToken: 'debug-token'});
    expect(appCheck.initializeAppCheck).toHaveBeenCalledTimes(1);
  });
});
