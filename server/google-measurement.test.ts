import assert from 'node:assert/strict';
import { test } from 'node:test';
import express, { type RequestHandler } from 'express';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ACADEMY_ORIGIN, adminMeasurementConfig, configFromIntegrationRows, createGoogleMeasurementService,
  defaultGoogleMeasurementConfig, escapeHtmlAttribute, googleMeasurementSchema, publicMeasurementConfig,
  registerAcademyCrawling, registerGoogleMeasurement, renderGoogleMeasurementHead,
  type GoogleMeasurementPool,
} from './google-measurement';
import { serveStatic } from './vite';

const enabledConfig = () => ({
  analytics: { enabled: true, measurementId: 'G-TEST123456', propertyId: '123456789' },
  searchConsole: { enabled: true, property: 'sc-domain:academy.findandstudy.com' as const, verificationMethod: 'dns' as const, verificationToken: '' },
});

function fixturePool(initial: any[] = []) {
  let rows = structuredClone(initial), snapshot: any[] = [];
  const queries: string[] = [];
  let connects = 0, failWrite = false;
  const query = async (sql: string, values: any[] = []) => {
    queries.push(sql);
    if (sql === 'BEGIN') { snapshot = structuredClone(rows); return { rows: [] }; }
    if (sql === 'ROLLBACK') { rows = snapshot; return { rows: [] }; }
    if (sql === 'COMMIT' || sql.startsWith('SELECT pg_advisory')) return { rows: [] };
    if (sql.startsWith('SELECT name, enabled, settings') || sql.startsWith('SELECT id, name')) {
      return { rows: rows.filter(row => values[0].includes(row.name)) };
    }
    if (failWrite) throw new Error('private-storage-error-with-secret');
    if (sql.startsWith('UPDATE integrations SET name=$2, enabled=false')) {
      const row = rows.find(row => row.id === values[0]);
      Object.assign(row, { name: values[1], enabled: false });
    } else if (sql.startsWith('UPDATE integrations SET name=$2')) {
      const row = rows.find(row => row.id === values[0]);
      Object.assign(row, { name: values[1], enabled: values[3], settings: values[4] });
    } else if (sql.startsWith('INSERT INTO integrations')) {
      rows.push({ id: values[0], name: values[1], enabled: values[3], settings: values[4] });
    } else throw new Error(`Unexpected fixture SQL: ${sql}`);
    return { rows: [] };
  };
  const pool: GoogleMeasurementPool = { query, async connect() { connects++; return { query, release() {} }; } };
  return { pool, queries, rows: () => rows, connects: () => connects, failWrites: () => { failWrite = true; } };
}

async function listen(app: express.Express) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  return { base: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}

test('configuration validation rejects secret fields, invalid IDs and incompatible verification methods', () => {
  assert(googleMeasurementSchema.safeParse(defaultGoogleMeasurementConfig()).success);
  assert(googleMeasurementSchema.safeParse(enabledConfig()).success);
  for (const input of [
    { ...enabledConfig(), apiKey: 'secret' },
    { ...enabledConfig(), analytics: { ...enabledConfig().analytics, apiSecret: 'secret' } },
    { ...enabledConfig(), analytics: { ...enabledConfig().analytics, measurementId: '' } },
    { ...enabledConfig(), analytics: { ...enabledConfig().analytics, measurementId: 'GTM-TEST123' } },
    { ...enabledConfig(), analytics: { ...enabledConfig().analytics, propertyId: 'account-123' } },
    { ...enabledConfig(), searchConsole: { ...enabledConfig().searchConsole, property: 'https://attacker.invalid/' } },
    { ...enabledConfig(), searchConsole: { ...enabledConfig().searchConsole, verificationMethod: 'html', verificationToken: 'valid-test-token' } },
    { ...enabledConfig(), searchConsole: { ...enabledConfig().searchConsole, property: `${ACADEMY_ORIGIN}/`, verificationMethod: 'html' } },
    { ...enabledConfig(), searchConsole: { ...enabledConfig().searchConsole, property: `${ACADEMY_ORIGIN}/`, verificationMethod: 'html', verificationToken: '"><script>alert(1)</script>' } },
  ]) assert.equal(googleMeasurementSchema.safeParse(input).success, false);
  const normalized = googleMeasurementSchema.parse({
    analytics: { enabled: true, measurementId: '  g-test123456 ' },
    searchConsole: { enabled: false, property: '', verificationMethod: 'dns' },
  });
  assert.equal(normalized.analytics.measurementId, 'G-TEST123456');
  assert.equal(normalized.analytics.propertyId, '');
  assert.equal(normalized.searchConsole.property, 'sc-domain:academy.findandstudy.com');
});

test('read path whitelists configuration and disables corrupt or ambiguous integrations', async () => {
  const config = enabledConfig();
  const row = { id: 'internal-id', name: 'google_analytics', enabled: true,
    settings: JSON.stringify(config.analytics), apiKey: 'secret-key', apiSecret: 'secret-secret', smtpPass: 'secret-mail' };
  const fixture = fixturePool([row, { name: 'other_analytics', enabled: true, settings: '{}' }]);
  const service = createGoogleMeasurementService(fixture.pool);
  assert.deepEqual(publicMeasurementConfig(await service.read()), {
    success: true, analyticsEnabled: true, measurementId: 'G-TEST123456', consentRequired: true,
  });
  assert.equal(fixture.connects(), 0, 'public read never opens a transaction');
  assert.equal(fixture.queries.length, 1);
  assert.match(fixture.queries[0], /^SELECT name, enabled, settings FROM integrations/);
  assert.doesNotMatch(fixture.queries[0], /SELECT\s+\*|api_key|api_secret|smtp_pass|\bUPDATE\b/i);
  assert.doesNotMatch(JSON.stringify(adminMeasurementConfig(await service.read())), /secret|internal-id/);
  for (const rows of [
    [{ ...row, enabled: false }], [{ ...row, settings: '{invalid' }],
    [row, { ...row, id: 'duplicate' }],
    [{ ...row, settings: JSON.stringify({ ...config.analytics, apiKey: 'secret' }) }],
    [{ ...row, settings: JSON.stringify({ enabled: true, measurementId: '' }) }],
  ]) {
    assert.deepEqual(publicMeasurementConfig(configFromIntegrationRows(rows)), {
      success: true, analyticsEnabled: false, measurementId: null, consentRequired: true,
    });
  }
});

test('transactional save repairs duplicates, remains idempotent, and rolls back failed writes', async () => {
  const fixture = fixturePool([
    { id: 'oldest', name: 'google_analytics', enabled: true, settings: '{}' },
    { id: 'duplicate', name: 'google_analytics', enabled: true, settings: '{}' },
    { id: 'unrelated', name: 'email_provider', enabled: true, settings: '{"kept":true}' },
  ]);
  const service = createGoogleMeasurementService(fixture.pool);
  assert.equal((await service.read()).analytics.enabled, false);
  await service.save(enabledConfig(), 'administrator-id');
  await service.save(enabledConfig(), 'administrator-id');
  for (const name of ['google_analytics', 'google_search_console']) {
    assert.equal(fixture.rows().filter(row => row.name === name).length, 1);
  }
  assert.deepEqual(await service.read(), enabledConfig());
  assert.equal(fixture.rows().find(row => row.id === 'duplicate').enabled, false);
  assert.match(fixture.rows().find(row => row.id === 'duplicate').name, /^archived_google_analytics_/);
  assert.equal(fixture.rows().find(row => row.id === 'unrelated').settings, '{"kept":true}');
  const begin = fixture.queries.indexOf('BEGIN');
  assert.match(fixture.queries[begin + 1], /^SELECT pg_advisory_xact_lock/);
  assert.match(fixture.queries[begin + 2], /FOR UPDATE$/);
  const before = structuredClone(fixture.rows());
  fixture.failWrites();
  await assert.rejects(service.save(defaultGoogleMeasurementConfig(), 'administrator-id'));
  assert.deepEqual(fixture.rows(), before);
  assert.equal(fixture.queries.at(-1), 'ROLLBACK');
});

test('HTTP public/admin endpoints enforce authorization, validate before writes, and fail closed', async () => {
  const fixture = fixturePool();
  let publicAuthCalls = 0;
  const auth: RequestHandler = (req, res, next) => {
    publicAuthCalls++;
    if (!req.headers['x-test-role']) return void res.status(401).json({ success: false });
    (req as any).user = { id: 'test-admin', role: req.headers['x-test-role'] }; next();
  };
  const admin: RequestHandler = (req, res, next) => {
    if ((req as any).user.role !== 'admin') return void res.status(403).json({ success: false });
    next();
  };
  const app = express(); app.use(express.json());
  const service = createGoogleMeasurementService(fixture.pool);
  registerGoogleMeasurement(app, auth, admin, service);
  const http = await listen(app);
  try {
    const request = (method: string, role?: string, body?: any) => fetch(http.base + '/api/admin/google-measurement', {
      method, headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const publicResponse = await fetch(http.base + '/api/public/measurement-config');
    assert.equal(publicResponse.headers.get('cache-control'), 'no-store');
    assert.equal(publicAuthCalls, 0);
    assert.deepEqual(await publicResponse.json(), { success: true, analyticsEnabled: false, measurementId: null, consentRequired: true });
    const measurementFrame = await fetch(http.base + '/api/public/measurement-frame?token=not-reflected');
    assert.equal(measurementFrame.status, 200);
    assert.match(measurementFrame.headers.get('content-type')!, /text\/html/);
    assert.equal(measurementFrame.headers.get('cache-control'), 'no-store');
    assert.equal(measurementFrame.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(measurementFrame.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(publicAuthCalls, 0);
    const frameHtml = await measurementFrame.text();
    assert.match(frameHtml, /<body><\/body>/);
    assert.doesNotMatch(frameHtml, /script|form|not-reflected|test-admin|G-TEST/);
    assert.equal((await request('GET')).status, 401);
    assert.equal((await request('PUT', undefined, enabledConfig())).status, 401);
    assert.equal((await request('PUT', 'staff', enabledConfig())).status, 403);
    assert.equal(fixture.connects(), 0);
    const invalid = await request('PUT', 'admin', { ...enabledConfig(), apiKey: 'private-key' });
    assert.equal(invalid.status, 400);
    assert.equal(fixture.connects(), 0);
    const saved = await request('PUT', 'admin', enabledConfig());
    assert.equal(saved.status, 200);
    assert.match(saved.headers.get('cache-control')!, /no-store, private/);
    const data = await saved.json();
    assert.equal(data.status.analytics, 'configured');
    assert.equal(data.status.searchConsole, 'dns_verification_managed_in_google');
    assert.doesNotMatch(JSON.stringify(data), /connected|verified|secret|apiKey/);
    const before = fixture.connects();
    assert.equal((await (await fetch(http.base + '/api/public/measurement-config')).json()).measurementId, 'G-TEST123456');
    assert.equal(fixture.connects(), before);
    await request('PUT', 'admin', { ...enabledConfig(), analytics: { ...enabledConfig().analytics, enabled: false } });
    assert.equal((await (await fetch(http.base + '/api/public/measurement-config')).json()).measurementId, null);
    const savedRead = service.read;
    service.read = async () => { throw new Error('private-storage-secret'); };
    assert.equal((await (await fetch(http.base + '/api/public/measurement-config')).json()).analyticsEnabled, false);
    const failed = await request('GET', 'admin');
    assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /private-storage-secret/);
    service.read = savedRead;
  } finally { await http.close(); }
});

test('verification markup is escaped and appears in the initial production head; private URLs are noindex', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'academy-google-head-'));
  await writeFile(path.join(directory, 'index.html'), '<!doctype html><html><head><title>Academy</title></head><body><div id="root"></div></body></html>');
  await writeFile(path.join(directory, 'asset.js'), 'window.testAsset=true;');
  const config = defaultGoogleMeasurementConfig();
  config.searchConsole = { enabled: true, property: `${ACADEMY_ORIGIN}/`, verificationMethod: 'html', verificationToken: 'safe-verification-token' };
  const app = express(); registerAcademyCrawling(app); serveStatic(app, async () => config, directory);
  const http = await listen(app);
  try {
    let response = await fetch(http.base + '/');
    assert.equal(response.headers.get('x-robots-tag'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const html = await response.text();
    assert.match(html, /<head>[\s\S]*google-site-verification[\s\S]*<\/head>/);
    assert.match(html, /content="safe-verification-token"/);
    assert.match(html, /rel="canonical" href="https:\/\/academy.findandstudy.com\/"/);
    assert.doesNotMatch(html, /googletagmanager|G-TEST|apiKey/);
    for (const url of ['/index.html', '/admin/dashboard', '/agent/courses', '/reset-password?token=private-reset-token', '/verify?code=private-certificate', '/?promo=PRIVATE', '/api/sso?token=private-sso']) {
      response = await fetch(http.base + url);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', url);
      const privateHtml = await response.text();
      assert.match(privateHtml, /<meta name="robots" content="noindex, nofollow"/);
      assert.doesNotMatch(privateHtml, /google-site-verification|private-reset-token|private-certificate|private-sso|PRIVATE/);
    }
    assert.equal(await (await fetch(http.base + '/asset.js')).text(), 'window.testAsset=true;');
    const head = await fetch(http.base + '/', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
    const robots = await (await fetch(http.base + '/robots.txt')).text();
    assert.match(robots, /Allow: \/\$/); assert.match(robots, /Allow: \/assets\//);
    assert.match(robots, /Allow: \/api\/public\/countries\$/);
    assert.doesNotMatch(robots, /Disallow: \/\n/);
    for (const route of ['admin', 'agent', 'api', 'reset-password', 'verify']) assert(robots.includes(`Disallow: /${route}`));
    response = await fetch(http.base + '/sitemap.xml');
    assert.match(response.headers.get('content-type')!, /application\/xml/);
    const sitemap = await response.text();
    assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), [`${ACADEMY_ORIGIN}/`]);
    assert.doesNotMatch(sitemap, /admin|agent|api|password|token|verify/);
    config.searchConsole.enabled = false;
    assert.doesNotMatch(await (await fetch(http.base + '/')).text(), /google-site-verification/);
  } finally { await http.close(); await rm(directory, { recursive: true }); }
  assert.equal(escapeHtmlAttribute('a&<>"\''), 'a&amp;&lt;&gt;&quot;&#39;');
  const maliciousConfig = defaultGoogleMeasurementConfig();
  maliciousConfig.searchConsole = { enabled: true, property: `${ACADEMY_ORIGIN}/`, verificationMethod: 'html', verificationToken: '"><script>alert(1)</script>' };
  const escaped = renderGoogleMeasurementHead('<head></head>', '/', maliciousConfig);
  assert.doesNotMatch(escaped, /<script>/);
  assert.match(escaped, /&quot;&gt;&lt;script&gt;/);
});
