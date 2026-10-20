import assert from 'node:assert/strict';
import { after, test } from 'node:test';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: new MemoryStorage(), configurable: true });
const auth = await import('../client/src/lib/auth');
const { storage } = await import('../client/src/lib/storage');
const { useAuthStore } = await import('../client/src/store/auth');
const attribution = await import('../client/src/lib/email-attribution');
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });
const admin = { id: 'fixture-admin', name: 'Fixture', email: 'fixture@example.test', role: 'admin' as const };
const agent = { ...admin, id: 'fixture-agent', role: 'agent' as const };
const credentials = { email: 'fixture@example.test', password: 'fixture-password' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function signedIn() {
  storage.setSession({ user: admin, role: 'admin' });
  useAuthStore.setState({ user: admin, role: 'admin', isLoading: false });
}

test('logout posts the server cookie and preserves auth until confirmed success', async () => {
  signedIn();
  const response = deferred<Response>();
  const requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => { requests.push({ url: String(url), init }); return response.promise; };
  const logout = useAuthStore.getState().logout();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(useAuthStore.getState().user?.id, admin.id);
  assert.equal(storage.getSession()?.user.id, admin.id);
  assert.equal(useAuthStore.getState().isLoading, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/logout');
  assert.equal(requests[0].init?.method, 'POST');
  assert.equal(requests[0].init?.credentials, 'include');
  response.resolve(json({ success: true }));
  assert.equal(await logout, true);
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().role, null);
  assert.equal(useAuthStore.getState().isLoading, false);
  assert.equal(storage.getSession(), null);
});

test('400, failed JSON, malformed responses and network errors do not pretend to log out', async () => {
  for (const response of [
    async () => json({ success: false }, 400),
    async () => json({ success: false }),
    async () => new Response('not json'),
    async () => { throw new Error('offline fixture'); },
  ]) {
    signedIn();
    globalThis.fetch = response;
    assert.equal(await useAuthStore.getState().logout(), false);
    assert.equal(useAuthStore.getState().user?.id, admin.id);
    assert.equal(useAuthStore.getState().role, 'admin');
    assert.equal(useAuthStore.getState().isLoading, false);
    assert.equal(storage.getSession()?.user.id, admin.id);
    assert.equal(auth.isLogoutInProgress(), false);
  }
});

test('missing server session clears cache without sending an explicit logout request', async () => {
  signedIn();
  const urls: string[] = [];
  globalThis.fetch = async url => { urls.push(String(url)); return json({ success: false }, 401); };
  await useAuthStore.getState().initialize();
  assert.deepEqual(urls, ['/api/me']);
  assert.equal(storage.getSession(), null);
  assert.equal(useAuthStore.getState().user, null);
});

test('a stale successful session hydration cannot restore auth after logout', async () => {
  signedIn();
  const hydration = deferred<Response>();
  globalThis.fetch = async url => String(url) === '/api/me' ? hydration.promise : json({ success: true });
  const initialize = useAuthStore.getState().initialize();
  assert.equal(await useAuthStore.getState().logout(), true);
  hydration.resolve(json({ success: true, user: admin }));
  await initialize;
  assert.equal(storage.getSession(), null);
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().isLoading, false);
});

test('a stale failed validation cannot clear a newer login cache or store', async () => {
  signedIn();
  const hydration = deferred<Response>();
  globalThis.fetch = async url => String(url) === '/api/me' ? hydration.promise : json({ success: true, user: agent });
  const initialize = useAuthStore.getState().initialize();
  assert.equal(await useAuthStore.getState().login(credentials), true);
  hydration.resolve(json({ success: false }, 401));
  await initialize;
  assert.equal(storage.getSession()?.user.id, agent.id);
  assert.equal(useAuthStore.getState().user?.id, agent.id);
  assert.equal(useAuthStore.getState().isLoading, false);
});

test('logout waits for an already-started login before revoking, and blocks new auth work meanwhile', async () => {
  signedIn();
  const loginResponse = deferred<Response>();
  const urls: string[] = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    return String(url) === '/api/login' ? loginResponse.promise : json({ success: true });
  };
  const login = useAuthStore.getState().login(credentials);
  const logout = useAuthStore.getState().logout();
  assert.equal(await useAuthStore.getState().login(credentials), false);
  await useAuthStore.getState().initialize();
  assert.deepEqual(urls, ['/api/login']);
  loginResponse.resolve(json({ success: true, user: agent }));
  assert.equal(await login, false);
  assert.equal(await logout, true);
  assert.deepEqual(urls, ['/api/login', '/api/logout']);
  assert.equal(storage.getSession(), null);
  assert.equal(useAuthStore.getState().user, null);
});

test('repeated explicit logout calls share one revocation request', async () => {
  signedIn();
  const response = deferred<Response>();
  let requests = 0;
  globalThis.fetch = async () => { requests++; return response.promise; };
  const first = auth.logout();
  const second = auth.logout();
  assert.equal(first, second);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(requests, 1);
  response.resolve(json({ success: true }));
  assert.equal(await first, true);
});

test('a hanging earlier login bounds logout to ten seconds and never publishes its late result', async context => {
  signedIn();
  const loginResponse = deferred<Response>();
  const urls: string[] = [];
  globalThis.fetch = async url => { urls.push(String(url)); return loginResponse.promise; };
  const login = useAuthStore.getState().login(credentials);
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const logout = useAuthStore.getState().logout();
  context.mock.timers.tick(10_000);
  assert.equal(await logout, false);
  assert.equal(useAuthStore.getState().user?.id, admin.id);
  assert.equal(useAuthStore.getState().isLoading, false);
  assert.deepEqual(urls, ['/api/login'], 'no claim of server revocation before earlier login settles');
  loginResponse.resolve(json({ success: true, user: agent }));
  assert.equal(await login, false);
  assert.equal(storage.getSession()?.user.id, admin.id);
});

const signupData = { name: 'Fixture', email: 'fixture@example.test', password: 'fixture-password', agencyName: 'Fixture Agency', country: 'TR', phone: '+905551234567' };

test('signup measurement is success-only and exposes only the fixed promo/standard method', async () => {
  const methods: string[] = [];
  const unsubscribe = attribution.onSuccessfulSignup(method => methods.push(method));
  const throwing = attribution.onSuccessfulSignup(() => { throw new Error('measurement fixture'); });
  const originalError = console.error; console.error = () => {};
  try {
    globalThis.fetch = async () => json({ success: false, message: 'Signup failed' }, 400);
    await assert.rejects(auth.signupAgent(signupData));
    assert.deepEqual(methods, []);
    globalThis.fetch = async () => json({ success: 'true', pending: true });
    await assert.rejects(auth.signupAgent(signupData));
    assert.deepEqual(methods, [], 'malformed success flags never count a registration');
    globalThis.fetch = async () => json({ success: true, pending: true });
    assert.equal((await auth.signupAgent({ ...signupData, promoCode: 'PRIVATE_PROMO' })).pending, true);
    assert.equal((await auth.signupAgent(signupData)).pending, true);
    assert.deepEqual(methods, ['promo', 'standard']);
    assert.equal(JSON.stringify(methods).includes('PRIVATE_PROMO'), false);
  } finally { console.error = originalError; unsubscribe(); throwing(); }
});

test('signup only forwards the current accepted public receipt; withdrawal removes the optional field', async () => {
  const opaque = 'cGF5bG9hZA.c2lnbmF0dXJl';
  const win = {
    location: new URL('https://academy.findandstudy.com/signup?utm_source=newsletter&utm_medium=email&utm_campaign=academy_launch_2026&utm_content=email_01_en'),
    localStorage, setTimeout, clearTimeout,
  } as unknown as Window;
  const client = attribution.emailAttributionClient(win, {
    randomUUID: () => '00000000-0000-4000-8000-000000000001',
    fetcher: async () => json({ success: true, token: opaque, expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString() }),
  });
  client.setContext({ consent: 'accepted', enabled: true, anonymous: true });
  assert.equal(await client.registrationToken(), opaque);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  const payloads: Record<string, unknown>[] = [];
  globalThis.fetch = async (_url, init) => { payloads.push(JSON.parse(String(init?.body))); return json({ success: true, pending: true }); };
  try {
    await auth.signupAgent({ ...signupData, emailAttributionToken: opaque });
    assert.equal(payloads[0].emailAttributionToken, opaque);
    client.setContext({ consent: 'declined', enabled: true, anonymous: true });
    await auth.signupAgent({ ...signupData, emailAttributionToken: opaque });
    assert.equal('emailAttributionToken' in payloads[1], false);
  } finally {
    client.destroy();
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else delete (globalThis as any).window;
  }
});

test('a stale signup response after logout cannot emit a conversion', async () => {
  const response = deferred<Response>();
  const methods: string[] = [];
  const unsubscribe = attribution.onSuccessfulSignup(method => methods.push(method));
  globalThis.fetch = async url => String(url) === '/api/signup' ? response.promise : json({ success: true });
  const signup = auth.signupAgent(signupData);
  const logout = auth.logout();
  response.resolve(json({ success: true, pending: true }));
  await signup; assert.equal(await logout, true); assert.deepEqual(methods, []);
  unsubscribe();
});
