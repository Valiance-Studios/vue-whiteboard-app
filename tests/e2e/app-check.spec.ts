import {expect, test} from '@playwright/test';
import {signIn} from './support/auth';

test('App Check stays off against the emulators, so no reCAPTCHA is loaded', async ({page}) => {
  const recaptchaRequests: string[] = [];
  page.on('request', (request) => {
    if (/recaptcha|appcheck/i.test(request.url())) {
      recaptchaRequests.push(request.url());
    }
  });

  await signIn(page);
  await expect(page.getByText('No boards yet')).toBeVisible();

  expect(recaptchaRequests).toEqual([]);
});
