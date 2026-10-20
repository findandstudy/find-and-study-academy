import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clearMeasurementCookies, createGoogleTagTransport, createMeasurementController, isMeasurementPublicPath, MEASUREMENT_CONSENT_KEY,
  readMeasurementConfig, readMeasurementConsent, sanitizeMeasurementLocation,
  saveMeasurementConsent, type MeasurementPage,
} from '../client/src/lib/google-measurement';
import { getGoogleMeasurementCopy, GOOGLE_MEASUREMENT_COPY_KEYS, GOOGLE_MEASUREMENT_COPY_ROWS } from '../client/src/lib/google-measurement-copy';
import { LANGUAGE_CODES } from '../shared/languages';

const origin = 'https://academy.findandstudy.com';
const config = { analyticsEnabled: true, measurementId: 'G-TEST12345', consentRequired: true as const };

function fixture(path = '/') {
  const events: MeasurementPage[] = [];
  const transports: { stopped: boolean }[] = [];
  const listeners = new EventTarget();
  let location = new URL(path, origin);
  let beforeHistory: (() => void) | undefined;
  const win = {
    get location() { return location; },
    document: { referrer: origin + '/login?token=SECRET#SECRET', cookie: '' },
    history: {
      pushState(_data: unknown, _unused: string, url?: string | URL | null) {
        beforeHistory?.();
        if (url != null) location = new URL(url, location);
      },
      replaceState(_data: unknown, _unused: string, url?: string | URL | null) {
        beforeHistory?.();
        if (url != null) location = new URL(url, location);
      },
    },
    addEventListener: listeners.addEventListener.bind(listeners),
    removeEventListener: listeners.removeEventListener.bind(listeners),
  };
  const controller = createMeasurementController(win as unknown as Window, (_win, _id, initial) => {
    assert.equal(initial.page_location.includes('SECRET'), false);
    const transport = { stopped: false };
    transports.push(transport);
    return {
      pageView(page) { assert.equal(transport.stopped, false); events.push(page); },
      stop() { transport.stopped = true; },
    };
  });
  return { controller, events, transports, win, setBeforeHistory(callback: () => void) { beforeHistory = callback; } };
}

test('only the three exact public routes are eligible and every query/hash is stripped', () => {
  for (const path of ['/', '/login', '/signup']) assert.equal(isMeasurementPublicPath(path), true);
  for (const path of ['/admin', '/admin/dashboard', '/agent', '/agent/profile', '/api', '/api/public/measurement-config', '/forgot-password', '/reset-password', '/verify', '/sso', '/embed', '/login/', '/login/../verify', '/%6cogin', '//login']) assert.equal(isMeasurementPublicPath(path), false, path);
  assert.equal(sanitizeMeasurementLocation(origin + '/signup?email=person@example.com&token=SECRET&utm_campaign=SECRET#SECRET', origin), origin + '/signup');
  assert.equal(sanitizeMeasurementLocation('/login?reset=SECRET', origin), origin + '/login');
  for (const value of ['https://example.com/login?token=SECRET', 'javascript:alert(1)', 'https://person:secret@academy.findandstudy.com/', '/admin?token=SECRET', '/verify?id=SECRET', '/reset-password?token=SECRET']) assert.equal(sanitizeMeasurementLocation(value, origin), '', value);
});

test('public config validation fails closed on malformed, disabled-consent or unrelated IDs', () => {
  assert.deepEqual(readMeasurementConfig({ success: true, ...config }), config);
  assert.deepEqual(readMeasurementConfig({ success: true, ...config, analyticsEnabled: false, measurementId: null }), { ...config, analyticsEnabled: false, measurementId: null });
  for (const value of [null, {}, { success: false, ...config }, { success: true, ...config, consentRequired: false }, { success: true, ...config, measurementId: null }, { success: true, ...config, measurementId: 'AW-12345678' }, { success: true, ...config, measurementId: 'G-TEST<script>' }]) assert.equal(readMeasurementConfig(value), null);
});

test('consent is explicit, expires, tolerates inaccessible storage and contains no account values', () => {
  let value: string | null = null;
  const storage = { getItem: () => value, setItem(key: string, next: string) { assert.equal(key, MEASUREMENT_CONSENT_KEY); value = next; } };
  assert.equal(readMeasurementConsent(storage), null);
  saveMeasurementConsent(storage, 'accepted');
  assert.equal(readMeasurementConsent(storage), 'accepted');
  assert.deepEqual(Object.keys(JSON.parse(value!)), ['choice', 'updatedAt']);
  saveMeasurementConsent(storage, 'declined');
  assert.equal(readMeasurementConsent(storage), 'declined');
  value = JSON.stringify({ choice: 'accepted', updatedAt: 100 });
  assert.equal(readMeasurementConsent(storage, 100 + 181 * 86400_000), null);
  assert.equal(readMeasurementConsent(storage, 99), null);
  assert.equal(readMeasurementConsent({ getItem() { throw new Error('blocked'); } }), null);
  saveMeasurementConsent({ setItem() { throw new Error('blocked'); } }, 'declined');
});

test('unknown and declined consent produce no provider loads or events', () => {
  const f = fixture();
  f.controller.setConfig(config);
  f.controller.setPermitted(true);
  f.controller.setConsent(null);
  f.controller.setConsent('declined');
  f.win.history.pushState(null, '', '/login?token=SECRET');
  assert.equal(f.transports.length, 0);
  assert.equal(f.events.length, 0);
  f.controller.destroy();
});

test('accepted consent never loads on private, reset, verification, API, SSO or embed routes', () => {
  for (const path of ['/admin/dashboard', '/agent/profile', '/reset-password?token=SECRET', '/forgot-password', '/verify?certificate=SECRET', '/api', '/sso', '/embed']) {
    const f = fixture(path);
    f.controller.setConfig(config);
    f.controller.setPermitted(true);
    f.controller.setConsent('accepted');
    assert.equal(f.transports.length, 0, path);
    assert.equal(f.events.length, 0, path);
    f.controller.destroy();
  }
});

test('manual SPA pageviews deduplicate rerenders and raw query/hash changes', () => {
  const f = fixture('/?token=SECRET#SECRET');
  f.controller.setConfig(config);
  f.controller.setPermitted(true);
  f.controller.setConsent('accepted');
  f.controller.setConsent('accepted');
  f.controller.setConfig({ ...config });
  f.win.history.replaceState(null, '', '/?email=person@example.com&utm_campaign=SECRET#NEW');
  assert.equal(f.events.length, 1);
  assert.deepEqual(f.events[0], { page_location: origin + '/', page_referrer: '', page_title: 'Find And Study Academy' });
  f.win.history.pushState(null, '', '/login?token=SECRET');
  f.win.history.pushState(null, '', '/signup?promoCode=SECRET');
  assert.equal(f.events.length, 3);
  assert.equal(f.transports.length, 1);
  assert.equal(f.events[2].page_referrer, origin + '/login');
  assert.equal(JSON.stringify(f.events).includes('SECRET'), false);
  assert.equal(JSON.stringify(f.events).includes('person@'), false);
  f.controller.destroy();
});

test('private navigation stops before history callbacks, private return never leaks referrer', () => {
  const f = fixture();
  f.controller.setConfig(config);
  f.controller.setPermitted(true);
  f.controller.setConsent('accepted');
  f.setBeforeHistory(() => assert.equal(f.transports[0].stopped, true));
  f.win.history.pushState(null, '', '/agent/profile?email=SECRET');
  assert.equal(f.events.length, 1);
  assert.equal((f.win as unknown as Record<string, unknown>)['ga-disable-G-TEST12345'], true);
  f.win.history.replaceState(null, '', '/login?token=SECRET');
  assert.equal(f.events.length, 1, 'return waits for a fresh public configuration');
  f.controller.setConfig(config);
  assert.equal(f.events.length, 2);
  assert.equal(f.events[1].page_referrer, '');
  f.controller.destroy();
});

test('revoking stops immediately; reaccepting creates one fresh transport and view', () => {
  const f = fixture('/login');
  f.controller.setConfig(config);
  f.controller.setPermitted(true);
  f.controller.setConsent('accepted');
  f.controller.setConsent('declined');
  assert.equal(f.transports[0].stopped, true);
  f.win.history.pushState(null, '', '/signup?token=SECRET');
  assert.equal(f.events.length, 1);
  f.controller.setConsent('accepted');
  assert.equal(f.transports.length, 2);
  assert.equal(f.events.length, 2);
  f.controller.setPermitted(false);
  assert.equal(f.transports[1].stopped, true);
  f.controller.setConfig({ ...config, analyticsEnabled: false });
  f.controller.setPermitted(true);
  assert.equal(f.events.length, 2);
  f.controller.destroy();
});

test('admin disable while away cannot be bypassed by cached config or consent', () => {
  const f = fixture('/login');
  f.controller.setConfig(config);
  f.controller.setPermitted(true);
  f.controller.setConsent('accepted');
  const requestEpoch = f.controller.getConfigEpoch();
  assert.equal(f.events.length, 1, 'initial config-before-permission ordering remains valid');
  f.win.history.pushState(null, '', '/forgot-password?token=SECRET');
  assert.notEqual(f.controller.getConfigEpoch(), requestEpoch, 'pre-exit responses are obsolete');
  // Even an accidentally delivered config on a private route is discarded.
  f.controller.setConfig(config);
  f.win.history.pushState(null, '', '/login');
  f.controller.setConsent('accepted');
  f.controller.setPermitted(true);
  assert.equal(f.transports.length, 1);
  assert.equal(f.events.length, 1);
  f.controller.setConfig({ ...config, analyticsEnabled: false });
  assert.equal(f.events.length, 1, 'fresh disabled config keeps measurement off');
  f.controller.setConfig(config);
  assert.equal(f.events.length, 2, 'only a fresh enabled config can restart measurement');
  f.controller.destroy();
});

test('loss of eligibility requires fresh config before an anonymous public return', () => {
  const f = fixture('/login');
  f.controller.setConfig(config);
  f.controller.setPermitted(true);
  f.controller.setConsent('accepted');
  const requestEpoch = f.controller.getConfigEpoch();
  f.controller.setPermitted(false);
  assert.equal(f.transports[0].stopped, true);
  assert.notEqual(f.controller.getConfigEpoch(), requestEpoch);
  f.controller.setPermitted(true);
  f.controller.setConsent('accepted');
  assert.equal(f.events.length, 1);
  f.controller.setConfig({ ...config, analyticsEnabled: false });
  assert.equal(f.events.length, 1);
  f.controller.setConfig(config);
  assert.equal(f.events.length, 2);
  f.controller.destroy();
});

test('real transport keeps Google and queued commands in an empty frame with denied ads and safe defaults', () => {
  const nodes: Record<string, any>[] = [];
  const tagWindow: Record<string, any> = {};
  let removed = false;
  const frame = {
    attributes: {} as Record<string, string>,
    setAttribute(key: string, value: string) { this.attributes[key] = value; },
    contentWindow: tagWindow,
    contentDocument: {
      createElement(tag: string) { return { tag }; },
      head: { appendChild(node: Record<string, any>) { nodes.push(node); } },
    },
    remove() {
      assert.equal(tagWindow['ga-disable-G-TEST12345'], true);
      removed = true;
    },
  };
  const win = {
    document: {
      createElement(tag: string) { assert.equal(tag, 'iframe'); return frame; },
      body: { appendChild(node: unknown) { assert.equal(node, frame); } },
    },
  } as unknown as Window;
  const page = { page_location: origin + '/login', page_referrer: '', page_title: 'Find And Study Academy | Sign in' };
  const transport = createGoogleTagTransport(win, config.measurementId!, page);
  assert.equal((win as any).gtag, undefined);
  assert.equal((win as any).dataLayer, undefined);
  assert.equal(frame.attributes['aria-hidden'], 'true');
  assert.deepEqual(nodes[0], { tag: 'meta', name: 'referrer', content: 'no-referrer' });
  assert.equal(nodes[1].tag, 'script');
  assert.equal(nodes[1].src, 'https://www.googletagmanager.com/gtag/js?id=G-TEST12345');
  assert.equal(nodes[1].referrerPolicy, 'no-referrer');
  const commands = tagWindow.dataLayer.map((command: IArguments) => Array.from(command));
  const consent = commands.find((command: any[]) => command[0] === 'consent')[2];
  assert.equal(consent.analytics_storage, 'granted');
  for (const key of ['ad_storage', 'ad_user_data', 'ad_personalization']) assert.equal(consent[key], 'denied');
  const setup = commands.find((command: any[]) => command[0] === 'config')[2];
  assert.equal(setup.send_page_view, false);
  assert.equal(setup.allow_google_signals, false);
  assert.equal(setup.allow_ad_personalization_signals, false);
  assert.equal(setup.cookie_prefix, 'fas_analytics');
  assert.equal(setup.page_location, origin + '/login');
  assert.equal(commands.filter((command: any[]) => command[0] === 'event').length, 0);
  transport.pageView(page);
  assert.equal(tagWindow.dataLayer.filter((command: IArguments) => command[0] === 'event' && command[1] === 'page_view').length, 1);
  transport.stop();
  transport.stop();
  assert.equal(removed, true);
  assert.equal((win as any)['ga-disable-G-TEST12345'], true);
  transport.pageView(page);
  assert.equal(tagWindow.dataLayer.length, 0);
});

test('withdrawal deletes only this integration’s analytics cookies and leaves login cookies intact', () => {
  const jar = new Map([['fas_analytics_ga', 'fixture'], ['fas_analytics_ga_TEST12345', 'fixture'], ['connect.sid', 'SESSION'], ['_ga', 'unrelated']]);
  const doc = {
    get cookie() { return [...jar].map(([key, value]) => key + '=' + value).join('; '); },
    set cookie(value: string) { if (value.includes('Max-Age=0')) jar.delete(value.split('=')[0]); },
  };
  clearMeasurementCookies(doc as Document, 'academy.findandstudy.com');
  assert.deepEqual([...jar.keys()], ['connect.sid', '_ga']);
});

test('all new public and admin copy is complete in all 23 supported languages', () => {
  assert.equal(LANGUAGE_CODES.length, 23);
  assert.deepEqual(Object.keys(GOOGLE_MEASUREMENT_COPY_ROWS).sort(), [...LANGUAGE_CODES].sort());
  for (const language of LANGUAGE_CODES) {
    assert.equal(GOOGLE_MEASUREMENT_COPY_ROWS[language].length, GOOGLE_MEASUREMENT_COPY_KEYS.length, language);
    const copy = getGoogleMeasurementCopy(language + '-XX');
    assert.deepEqual(Object.keys(copy), [...GOOGLE_MEASUREMENT_COPY_KEYS]);
    assert.equal(Object.values(copy).every(value => typeof value === 'string' && value.trim().length > 0), true, language);
  }
});
