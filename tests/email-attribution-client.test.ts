import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createEmailAttributionClient, EMAIL_ATTRIBUTION_STORAGE_KEY, publicEmailHref } from '../client/src/lib/email-attribution';
import { EMAIL_MESSAGE_IDS } from '../shared/email-attribution';

const origin = 'https://academy.findandstudy.com';
const token = 'cGF5bG9hZA.c2lnbmF0dXJl';
const query = (message = 'email_01_en') => `?promo=ACADEMY2026&utm_source=newsletter&utm_medium=email&utm_campaign=academy_launch_2026&utm_content=${message}&email=SECRET@example.test&token=SECRET#SECRET`;
class MemoryStorage {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
let uuidCounter = 0;
function fixture(path = '/signup' + query(), storage = new MemoryStorage(), custom?: typeof fetch) {
  let location = new URL(path, origin);
  let time = Date.parse('2026-10-21T10:00:00Z');
  const requests: { url: string; init?: RequestInit }[] = [];
  const win = {
    get location() { return location; }, localStorage: storage,
    setTimeout, clearTimeout,
  } as unknown as Window;
  const client = createEmailAttributionClient(win, {
    now: () => time,
    randomUUID: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`,
    fetcher: async (url, init) => {
      requests.push({ url: String(url), init });
      if (custom) return custom(url, init);
      return new Response(JSON.stringify({ success: true, token, expiresAt: new Date(time + 30 * 86400_000).toISOString() }), { headers: { 'Content-Type': 'application/json' } });
    },
  });
  const enable = () => client.setContext({ consent: 'accepted', enabled: true, anonymous: true });
  return { client, win, storage, requests, enable, advance(ms: number) { time += ms; }, navigate(path: string) { location = new URL(path, origin); } };
}

test('public link carry preserves only all ten canonical message tuples and optional valid signup promo', () => {
  for (const message of EMAIL_MESSAGE_IDS) {
    const f = fixture('/' + query(message));
    const target = new URL(publicEmailHref('/signup', 'ACADEMY2026', f.win), origin);
    assert.equal(target.searchParams.get('utm_content'), message);
    assert.equal(target.searchParams.get('promo'), 'ACADEMY2026');
    assert.equal(target.searchParams.size, 5);
    assert.equal(target.hash, '');
    assert.equal(target.href.includes('SECRET'), false);
    assert.equal(f.storage.writes, 0, 'link building does not persist analytics before consent');
    assert.equal(publicEmailHref('/agent/dashboard', undefined, f.win), '/agent/dashboard');
    f.navigate('/forgot-password?token=SECRET');
    assert.equal(publicEmailHref('/', undefined, f.win), '/');
  }
});

test('unknown/declined consent, disabled measurement, private pages and authenticated contexts produce no visit request or persistence', () => {
  for (const context of [
    { consent: null, enabled: true, anonymous: true },
    { consent: 'declined', enabled: true, anonymous: true },
    { consent: 'accepted', enabled: false, anonymous: true },
    { consent: 'accepted', enabled: true, anonymous: false },
  ] as const) {
    const f = fixture();
    f.client.setContext(context);
    assert.equal(f.client.messageId(), null);
    assert.equal(f.client.currentToken(), undefined);
    assert.equal(f.requests.length, 0);
    assert.equal(f.storage.writes, 0);
    f.client.destroy();
  }
  const f = fixture('/agent/profile' + query()); f.enable();
  assert.equal(f.requests.length, 0); assert.equal(f.storage.writes, 0); f.client.destroy();
});

test('accepted visit sends only finite message/UUID/consent with no credentials, URL, promo, referrer or form values', async () => {
  const f = fixture(); f.enable();
  assert.equal(await f.client.registrationToken(), token);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, '/api/public/email-attribution/visit');
  assert.equal(f.requests[0].init?.credentials, 'omit');
  assert.equal(f.requests[0].init?.referrerPolicy, 'no-referrer');
  assert.equal(f.requests[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(f.requests[0].init?.body)), { messageId: 'email_01_en', visitId: '00000000-0000-4000-8000-000000000001', consent: true });
  const stored = f.storage.getItem(EMAIL_ATTRIBUTION_STORAGE_KEY)!;
  assert.equal(stored.includes('SECRET'), false); assert.equal(stored.includes('ACADEMY2026'), false); assert.equal(stored.includes('https:'), false);
  assert.equal(f.client.messageId(), 'email_01_en');
  f.client.destroy();
});

test('reload and another tab reuse the browser’s message visit within thirty minutes; direct returns never add visits', async () => {
  const first = fixture(); first.enable(); await first.client.registrationToken(); first.client.destroy();
  const reload = fixture('/signup' + query(), first.storage); reload.enable();
  assert.equal(await reload.client.registrationToken(), token); assert.equal(reload.requests.length, 0);
  reload.navigate('/signup'); reload.advance(31 * 60_000); reload.enable();
  assert.equal(reload.client.messageId(), 'email_01_en'); assert.equal(await reload.client.registrationToken(), token); assert.equal(reload.requests.length, 0);
  reload.client.destroy();
  const later = fixture('/signup' + query(), first.storage); later.advance(31 * 60_000); later.enable();
  await later.client.registrationToken(); assert.equal(later.requests.length, 1, 'a new explicit email session after thirty minutes counts once'); later.client.destroy();
});

test('last valid email wins, invalid tuples/direct traffic cannot replace it, and thirty-day expiry removes it', async () => {
  const f = fixture(); f.enable(); await f.client.registrationToken();
  f.navigate('/signup' + query('email_05_tr')); f.client.messageId(); await f.client.registrationToken();
  assert.equal(f.client.messageId(), 'email_05_tr');
  f.navigate('/signup?utm_source=SECRET&utm_medium=email&utm_campaign=academy_launch_2026&utm_content=email_01_en');
  assert.equal(f.client.messageId(), 'email_05_tr'); assert.equal(f.requests.length, 2);
  f.navigate('/signup'); f.advance(31 * 86400_000);
  assert.equal(f.client.messageId(), null); assert.equal(f.client.currentToken(), undefined); assert.equal(f.requests.length, 2);
  assert.equal(f.storage.getItem(EMAIL_ATTRIBUTION_STORAGE_KEY), null);
  f.client.destroy();
});

test('revocation aborts pending visits, clears all source/receipt state and rejects a late response', async () => {
  let resolve!: (value: Response) => void;
  const f = fixture(undefined, undefined, async () => await new Promise<Response>(done => { resolve = done; }));
  f.enable();
  f.client.setContext({ consent: 'declined', enabled: true, anonymous: true });
  assert.equal(f.requests[0].init?.signal?.aborted, true);
  assert.equal(f.storage.getItem(EMAIL_ATTRIBUTION_STORAGE_KEY), null);
  resolve(new Response(JSON.stringify({ success: true, token, expiresAt: '2026-11-20T10:00:00Z' })));
  await delay(0);
  assert.equal(f.storage.getItem(EMAIL_ATTRIBUTION_STORAGE_KEY), null); assert.equal(f.client.currentToken(), undefined);
  f.client.destroy();
});

test('private navigation and stale response epochs cannot persist receipts or expose tokens', async () => {
  let resolve!: (value: Response) => void;
  const f = fixture(undefined, undefined, async () => await new Promise<Response>(done => { resolve = done; }));
  f.enable(); f.navigate('/reset-password?token=SECRET'); f.client.pause();
  assert.equal(f.requests[0].init?.signal?.aborted, true);
  resolve(new Response(JSON.stringify({ success: true, token, expiresAt: '2026-11-20T10:00:00Z' })));
  await delay(0);
  assert.equal(f.client.messageId(), null); assert.equal(f.client.currentToken(), undefined);
  assert.equal(f.storage.getItem(EMAIL_ATTRIBUTION_STORAGE_KEY)?.includes(token), false);
  f.client.destroy();
});

test('receipt failure has a bounded signup wait, never throws and never supplies an unconfirmed token', async () => {
  const f = fixture(undefined, undefined, async (_url, init) => await new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
  f.enable();
  assert.equal(await f.client.registrationToken(5), undefined);
  f.client.destroy();
  await delay(0);
});

test('storage events adopt the newer consented source and deletion cannot replay an old URL into a fresh visit', async () => {
  const first = fixture(); first.enable(); await first.client.registrationToken();
  const second = fixture('/signup' + query('email_05_tr'), first.storage); second.enable(); await second.client.registrationToken();
  first.client.storageChanged();
  assert.equal(first.client.messageId(), 'email_05_tr');
  assert.equal(first.requests.length, 1);
  second.client.setContext({ consent: 'declined', enabled: true, anonymous: true });
  first.client.storageChanged();
  assert.equal(first.client.currentToken(), undefined);
  assert.equal(first.client.messageId(), null);
  assert.equal(first.requests.length, 1, 'the old URL is not treated as a new entry after another tab cleared attribution');
  first.client.destroy(); second.client.destroy();
});
