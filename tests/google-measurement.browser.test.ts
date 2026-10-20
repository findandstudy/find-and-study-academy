import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

// All Google URLs are fulfilled locally; no request reaches a Google provider.
const providerFixture = `
(() => {
  const defaults = {};
  const consent = {};
  let id = '';
  const send = (event, values = {}) => {
    if (!id || window['ga-disable-' + id] || consent.analytics_storage !== 'granted') return;
    fetch('https://www.google-analytics.com/g/collect', { method: 'POST', body: JSON.stringify({ event, id, ...defaults, ...values, consent }) });
  };
  const consume = (command) => {
    const [kind, name, value] = Array.from(command);
    if (kind === 'consent') Object.assign(consent, value);
    if (kind === 'set') Object.assign(defaults, name);
    if (kind === 'config') {
      id = name; Object.assign(defaults, value);
      document.cookie = 'fas_analytics_ga=fixture; Path=/; SameSite=Lax; Secure';
      if (value.send_page_view !== false) send('page_view');
    }
    if (kind === 'event') send(name, value);
  };
  window.dataLayer.forEach(consume);
  window.dataLayer.push = (...commands) => { commands.forEach(consume); return 0; };
  // Simulate an over-eager provider: these must never see the parent app.
  document.addEventListener('submit', () => send('automatic_form', { formValue: document.querySelector('input')?.value }));
  window.addEventListener('popstate', () => send('automatic_history', { rawUrl: location.href }));
  const originalPush = history.pushState;
  history.pushState = function () { const result = originalPush.apply(this, arguments); send('automatic_history', { rawUrl: location.href }); return result; };
  setInterval(() => send('automatic_timer'), 30);
})();`;

test('isolated transport: basic consent, sanitized SPA views, zero private/revoked pings and safe reacceptance', async () => {
  const bundle = await build({ entryPoints: ['client/src/lib/google-measurement.ts'], bundle: true, format: 'iife', globalName: 'MeasurementFixture', write: false });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const hits: Record<string, any>[] = [];
    const tags: string[] = [];
    const unexpected: string[] = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'academy.findandstudy.com') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>SECRET account title</title><form><input name="email" value="SECRET@example.com"></form>' });
      if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
        tags.push(route.request().url());
        assert.equal(route.request().headers().referer, undefined);
        return route.fulfill({ contentType: 'application/javascript', body: providerFixture });
      }
      if (url.hostname === 'www.google-analytics.com' && url.pathname === '/g/collect') {
        assert.equal(route.request().headers().referer, undefined);
        hits.push(JSON.parse(route.request().postData() || '{}'));
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      unexpected.push(route.request().url());
      return route.abort();
    });
    await page.goto('https://academy.findandstudy.com/login?token=SECRET#SECRET');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(() => {
      const fixture = (window as any).MeasurementFixture;
      const controller = fixture.createMeasurementController(window);
      (window as any).measurementController = controller;
      controller.setPermitted(true);
      controller.setConfig({ analyticsEnabled: true, measurementId: 'G-FIXTURE123', consentRequired: true });
    });
    await page.waitForTimeout(80);
    assert.equal(tags.length, 0);
    assert.equal(hits.length, 0);
    await page.evaluate(() => (window as any).measurementController.setConsent('declined'));
    await page.waitForTimeout(80);
    assert.equal(tags.length, 0);
    assert.equal(hits.length, 0);

    await page.evaluate(() => (window as any).measurementController.setConsent('accepted'));
    await page.waitForFunction(() => document.querySelector('iframe[data-academy-measurement]')?.getAttribute('data-tag-status') === 'loaded');
    assert.equal(await page.locator('iframe[data-academy-measurement]').getAttribute('data-document-initialized'), 'true');
    await page.waitForFunction(() => document.querySelector('iframe[data-academy-measurement]')?.contentWindow?.document.cookie.includes('fas_analytics_ga'));
    await page.waitForTimeout(80);
    assert.equal(tags.length, 1);
    assert.equal(hits.filter(hit => hit.event === 'page_view').length, 1);
    assert.equal(hits[0].page_location, 'https://academy.findandstudy.com/login');
    assert.equal(hits[0].send_page_view, false);
    assert.equal(hits[0].allow_google_signals, false);
    assert.equal(hits[0].allow_ad_personalization_signals, false);
    assert.equal(hits[0].consent.analytics_storage, 'granted');
    for (const key of ['ad_storage', 'ad_user_data', 'ad_personalization']) assert.equal(hits[0].consent[key], 'denied');

    await page.evaluate(() => {
      document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      history.pushState(null, '', '/login?email=SECRET@example.com&utm_campaign=SECRET#SECRET');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(80);
    assert.equal(hits.filter(hit => hit.event === 'page_view').length, 1);
    assert.equal(hits.some(hit => ['automatic_form', 'automatic_history'].includes(hit.event)), false);
    assert.equal(JSON.stringify(hits).includes('SECRET'), false);

    const privateState = await page.evaluate(() => {
      history.pushState(null, '', '/agent/profile?token=SECRET');
      return { frames: document.querySelectorAll('iframe[data-academy-measurement]').length, disabled: (window as any)['ga-disable-G-FIXTURE123'] };
    });
    assert.deepEqual(privateState, { frames: 0, disabled: true });
    await page.waitForTimeout(60);
    const afterPrivate = hits.length;
    await page.waitForTimeout(100);
    assert.equal(hits.length, afterPrivate);
    assert.equal(tags.length, 1);

    await page.evaluate(() => history.pushState(null, '', '/signup?invite=SECRET'));
    await page.waitForTimeout(80);
    assert.equal(tags.length, 1, 'private return cannot reuse the earlier enabled config');
    assert.equal(hits.filter(hit => hit.event === 'page_view').length, 1);
    await page.evaluate(() => (window as any).measurementController.setConfig({ analyticsEnabled: false, measurementId: 'G-FIXTURE123', consentRequired: true }));
    await page.waitForTimeout(80);
    assert.equal(tags.length, 1, 'admin disable while away keeps measurement off');
    await page.evaluate(() => (window as any).measurementController.setConfig({ analyticsEnabled: true, measurementId: 'G-FIXTURE123', consentRequired: true }));
    await page.waitForTimeout(100);
    assert.equal(tags.length, 2);
    assert.equal(hits.filter(hit => hit.event === 'page_view').length, 2);
    assert.equal(hits.filter(hit => hit.event === 'page_view')[1].page_referrer, '');

    const revoked = await page.evaluate(() => {
      (window as any).measurementController.setConsent('declined');
      return { frames: document.querySelectorAll('iframe[data-academy-measurement]').length, cookie: document.cookie, disabled: (window as any)['ga-disable-G-FIXTURE123'] };
    });
    assert.equal(revoked.frames, 0);
    assert.equal(revoked.disabled, true);
    assert.equal(revoked.cookie.includes('fas_analytics_'), false);
    await page.waitForTimeout(60);
    const afterRevocation = hits.length;
    await page.waitForTimeout(100);
    assert.equal(hits.length, afterRevocation);

    await page.evaluate(() => {
      (window as any).measurementController.setConsent('accepted');
      (window as any).measurementController.setConsent('accepted');
      history.replaceState(null, '', '/signup?token=OTHER_SECRET#SECRET');
    });
    await page.waitForTimeout(100);
    assert.equal(tags.length, 3);
    assert.equal(hits.filter(hit => hit.event === 'page_view').length, 3);
    assert.equal(JSON.stringify(hits).includes('SECRET'), false);
    assert.deepEqual(unexpected, []);
    await page.evaluate(() => (window as any).measurementController.destroy());
    await context.close();
  } finally { await browser.close(); }
});
