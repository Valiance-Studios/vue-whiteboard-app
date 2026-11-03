import {expect, test} from '@playwright/test';
import {signIn} from './support/auth';

test('App Check stays off against the emulators, so no reCAPTCHA is loaded', async ({page}) => {
  const recaptchaRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());

    // Only off-site requests count: the dev server serves the app's own src/firebase/appCheck.ts module.
    if (url.hostname !== 'localhost' && /recaptcha|appcheck/i.test(url.href)) {
      recaptchaRequests.push(request.url());
    }
  });

  await signIn(page);
  await expect(page.getByText('No boards yet')).toBeVisible();

  expect(recaptchaRequests).toEqual([]);
});
