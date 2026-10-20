import assert from 'node:assert/strict';
import { test } from 'node:test';
import express, { type RequestHandler } from 'express';
import { readFile } from 'node:fs/promises';
import { EMAIL_MESSAGE_IDS, parseEmailMessageId } from '@shared/email-attribution';
import { publicSignupSchema } from '@shared/signup-validation';
import { assertEmailAttributionReady, createEmailAttributionService, readEmailAttributionToken, registerEmailAttribution, signEmailAttribution } from './email-attribution';

const now = Date.parse('2026-10-20T12:00:00.123Z');
const secret = 'isolated-attribution-test-secret';
const visitId = '10000000-0000-4000-8000-000000000001';
const otherId = '10000000-0000-4000-8000-000000000002';
const names = ['academy_email_visits_pkey', 'academy_email_visits_message_id_check', 'academy_email_registrations_pkey',
  'academy_email_registrations_user_id_fkey', 'academy_email_registrations_visit_id_fkey', 'academy_email_registrations_message_id_check'];
const columns = [
  ['academy_email_visits', 'id', 'uuid'], ['academy_email_visits', 'message_id', 'text'], ['academy_email_visits', 'created_at', 'timestamp with time zone'],
  ['academy_email_registrations', 'user_id', 'character varying'], ['academy_email_registrations', 'message_id', 'text'],
  ['academy_email_registrations', 'visit_id', 'uuid'], ['academy_email_registrations', 'created_at', 'timestamp with time zone'],
].map(([table_name, column_name, data_type]) => ({ table_name, column_name, data_type, is_nullable: 'NO' }));

function fixture() {
  const visits = new Map<string, any>(), registrations = new Map<string, any>();
  const queries: { sql: string; values: any[] }[] = [];
  let enabled = true, ready = true, failure = false;
  const pool = { async query(sql: string, values: any[] = []) {
    queries.push({ sql, values });
    if (failure) throw new Error('private-database-error');
    if (sql.includes('information_schema.columns')) return { rows: ready ? columns : [] };
    if (sql.includes('SELECT conname')) return { rows: names.map(conname => ({ conname })) };
    if (sql.startsWith('INSERT INTO academy_email_visits')) {
      if (visits.has(values[0])) return { rows: [] };
      const row = { id: values[0], message_id: values[1], created_at: new Date(now) };
      visits.set(row.id, row); return { rows: [row] };
    }
    if (sql.startsWith('SELECT id,message_id,created_at')) return { rows: visits.has(values[0]) ? [visits.get(values[0])] : [] };
    if (sql.startsWith('INSERT INTO academy_email_registrations')) {
      const row = visits.get(values[1]);
      if (!row || row.message_id !== values[2] || row.created_at.toISOString() !== values[3] || registrations.has(values[0])) return { rows: [] };
      registrations.set(values[0], { user_id: values[0], message_id: values[2], visit_id: values[1] });
      return { rows: [{ user_id: values[0] }] };
    }
    if (sql.startsWith('SELECT message_id,count(*)')) return { rows: [{ message_id: 'email_01_en', visits: 4 }] };
    if (sql.startsWith('WITH attributed AS')) return { rows: [{ attributed: [{ message_id: 'email_01_en', registrations: 3, promo_registrations: 2, pending: 1, approved: 1, started: 1 }], unattributed_registrations: 7 }] };
    if (sql.startsWith('SELECT min(created_at)')) return { rows: [{ tracking_started_at: visits.size ? new Date(now) : null }] };
    throw new Error('Unexpected isolated attribution SQL: ' + sql);
  } };
  const service = createEmailAttributionService(pool, { analyticsEnabled: async () => enabled, secret: () => secret, now: () => now });
  return { pool, service, visits, registrations, queries, disable: () => { enabled = false; }, unavailable: () => { ready = false; }, fail: () => { failure = true; } };
}

test('only the ten canonical complete UTM tuples are accepted; unrelated URL data is never returned', () => {
  for (const id of EMAIL_MESSAGE_IDS) {
    assert.equal(parseEmailMessageId(`?utm_source=newsletter&utm_medium=email&utm_campaign=academy_launch_2026&utm_content=${id}&email=SECRET@example.invalid&promo=SECRET`), id);
  }
  for (const query of ['', '?utm_content=email_01_en', '?utm_source=newsletter&utm_medium=email&utm_campaign=wrong&utm_content=email_01_en',
    '?utm_source=newsletter&utm_medium=email&utm_campaign=academy_launch_2026&utm_content=email_06_en',
    '?utm_source=newsletter&utm_medium=email&utm_campaign=academy_launch_2026&utm_content=email_01_en&utm_content=email_02_en',
    '?utm_source=newsletter&utm_source=newsletter&utm_medium=email&utm_campaign=academy_launch_2026&utm_content=email_01_en']) assert.equal(parseEmailMessageId(query), null);
});

test('optional malformed attribution cannot reject an otherwise valid signup or allow privilege fields', () => {
  const signup = { name: 'Test Agent', email: 'test@example.invalid', password: 'fixture-password', agencyName: 'Test Agency', country: 'TR', phone: '+905551234567', languagePreference: 'en' };
  for (const emailAttributionToken of [undefined, null, 123, {}, 'x'.repeat(1537)]) {
    const result = publicSignupSchema.parse({ ...signup, emailAttributionToken });
    assert.equal(result.emailAttributionToken, undefined);
  }
  assert.equal(publicSignupSchema.parse({ ...signup, emailAttributionToken: 'invalid-but-bounded' }).emailAttributionToken, 'invalid-but-bounded');
  assert.equal(publicSignupSchema.safeParse({ ...signup, role: 'admin', emailAttributionToken: null }).success, false);
});

test('signed receipts reject tampering, wrong keys, malformed fields, future timestamps and expiry', () => {
  const payload = { v: 1 as const, messageId: 'email_01_en' as const, visitId, createdAt: now };
  const signed = signEmailAttribution(payload, secret);
  assert.deepEqual(readEmailAttributionToken(signed, secret, now), payload);
  assert.equal(readEmailAttributionToken(signed, 'wrong-secret', now), null);
  assert.equal(readEmailAttributionToken(signed.replace('email', 'other') + 'x', secret, now), null);
  assert.equal(readEmailAttributionToken(signed, secret, now + 30 * 86400_000), null);
  assert.equal(readEmailAttributionToken(signEmailAttribution({ ...payload, createdAt: now + 60_001 }, secret), secret, now), null);
  for (const value of ['', {}, 'x'.repeat(1537), 'a.b.c', 'not a receipt', signed + '=']) assert.equal(readEmailAttributionToken(value, secret, now), null);
  assert.equal(readEmailAttributionToken(signed, '', now), null);
});

test('visits are consent-gated, enabled-gated, idempotent and retain original timestamp on replay', async () => {
  const f = fixture();
  await assert.rejects(f.service.visit({ messageId: 'email_01_en', visitId, consent: false }));
  await assert.rejects(f.service.visit({ messageId: 'email_01_en', visitId, consent: true, email: 'SECRET@example.invalid' }));
  assert.equal(f.queries.length, 0);
  const a = await f.service.visit({ messageId: 'email_01_en', visitId, consent: true });
  const b = await f.service.visit({ messageId: 'email_01_en', visitId, consent: true });
  assert.equal(a.status, 200); assert.deepEqual(a, b); assert.equal(f.visits.size, 1);
  assert.equal(a.body.expiresAt, new Date(now + 30 * 86400_000).toISOString());
  assert.equal((await f.service.visit({ messageId: 'email_02_en', visitId, consent: true })).status, 409);
  f.disable();
  assert.equal((await f.service.visit({ messageId: 'email_01_en', visitId: otherId, consent: true })).status, 409);
  assert.equal(f.visits.size, 1);
  assert(f.queries.every(({ sql }) => !/analytics_metrics|\bip\b|user_agent|recipient|promo_code|code_hash/i.test(sql)));
});

test('only a persisted matching receipt records one conversion per created account, and optional failures stay optional', async () => {
  const f = fixture();
  const response = await f.service.visit({ messageId: 'email_01_en', visitId, consent: true });
  const token = response.body.token;
  assert.equal(await f.service.recordRegistration('account-1', 'invalid'), false);
  assert.equal(await f.service.recordRegistration('account-1', token), true);
  assert.equal(await f.service.recordRegistration('account-1', token), false);
  assert.equal(f.registrations.size, 1);
  const fabricated = signEmailAttribution({ v: 1, messageId: 'email_01_en', visitId: otherId, createdAt: now }, secret);
  assert.equal(await f.service.recordRegistration('account-2', fabricated), false);
  f.disable();
  assert.equal(await f.service.recordRegistration('account-2', token), false);
  const failed = fixture(); failed.fail();
  assert.equal(await failed.service.recordRegistration('account-3', token), false);
  const write = f.queries.find(row => row.sql.startsWith('INSERT INTO academy_email_registrations'))!;
  assert.match(write.sql, /ON CONFLICT\(user_id\) DO NOTHING/);
  assert.match(write.sql, /date_trunc\('milliseconds',v.created_at\)=\$4::timestamptz/);
  // PostgreSQL otherwise infers this repeated parameter from both a SELECT
  // target and comparison, producing 42P08 with real varchar user columns.
  assert.equal(write.sql.match(/\$1::varchar/g)?.length, 2);
  assert.match(write.sql, /SELECT \$1::varchar,v.message_id,v.id/);
  assert.match(write.sql, /COALESCE\(\(SELECT m.redeemed_at FROM academy_campaign_members m WHERE m.user_id=\$1::varchar\),now\(\)\)/);
  assert.doesNotMatch(write.sql, /metric_value|::json|email_address|recipient/);
});

test('readiness fails closed and migration is additive with both complete allowlists and constrained keys', async () => {
  const f = fixture(); f.unavailable();
  await assert.rejects(assertEmailAttributionReady(f.pool));
  await assert.rejects(f.service.visit({ messageId: 'email_01_en', visitId, consent: true }));
  assert.equal(f.visits.size, 0);
  const migration = await readFile(new URL('./email-attribution.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(migration, /\b(?:UPDATE|DELETE|DROP|TRUNCATE)\s+(?:TABLE\s+)?(?:users|academy_campaign_members|analytics_metrics)/i);
  assert.match(migration, /user_id varchar PRIMARY KEY REFERENCES users\(id\) ON DELETE CASCADE/);
  for (const id of EMAIL_MESSAGE_IDS) assert.equal(migration.split(`'${id}'`).length - 1, 2);
});

test('admin report uses inclusive UTC dates, ten zero-filled message rows, accurate pending definition and no account data', async () => {
  const f = fixture();
  const result = await f.service.report({ from: '2026-10-01', to: '2026-10-20', campaignId: visitId });
  assert.equal(result.rows.length, 10);
  assert.deepEqual(result.totals, { visits: 4, registrations: 3, promoRegistrations: 2, pending: 1, approved: 1, started: 1, unattributedPromoRegistrations: 7 });
  assert.equal(result.rows.find(row => row.messageId === 'email_05_tr')?.registrations, 0);
  assert.equal(result.visitsScope, 'email_series_all_campaigns');
  assert.equal(result.range.timeZone, 'UTC');
  assert.equal(result.trackingStartedAt, null);
  const reg = f.queries.find(row => row.sql.startsWith('WITH attributed AS'))!;
  assert.deepEqual(reg.values, ['2026-10-01T00:00:00.000Z', '2026-10-21T00:00:00.000Z', visitId]);
  assert.match(reg.sql, /u.status IS DISTINCT FROM 'active' AND a.status='pending'/);
  assert.match(reg.sql, /u.status='active'/);
  assert.doesNotMatch(JSON.stringify(result), /account-|user_id|recipient|email_address|password|SECRET/);
  for (const query of [{ from: '2026-02-30' }, { from: '2026-10-21', to: '2026-10-20' }, { campaignId: 'not-uuid' }, { to: ['2026-10-20'] }, { email: 'SECRET' }]) await assert.rejects(f.service.report(query));
});

test('attributed and unattributed promo counts use one SQL snapshot without shared pool transaction state', async () => {
  const f = fixture();
  const result = await f.service.report({});
  const conversionQueries = f.queries.filter(({ sql }) => sql.includes('academy_campaign_members'));
  assert.equal(conversionQueries.length, 1, 'Both promo partitions must be read by one statement');
  assert.match(conversionQueries[0].sql, /WITH attributed AS[\s\S]+unattributed AS[\s\S]+jsonb_agg\(attributed\)/);
  assert.match(conversionQueries[0].sql, /LEFT JOIN academy_email_registrations r ON r.user_id=m.user_id WHERE r.user_id IS NULL/);
  assert.equal(result.totals.promoRegistrations + result.totals.unattributedPromoRegistrations, 9);
  assert(f.queries.every(({ sql }) => !/^\s*(?:BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)));
});

test('HTTP visit requires same-origin consent and admin report requires an administrator; no receipts are returned by report', async () => {
  const f = fixture(); const app = express(); app.use(express.json());
  const auth: RequestHandler = (req, res, next) => req.get('x-test-role') ? next() : void res.sendStatus(401);
  const admin: RequestHandler = (req, res, next) => req.get('x-test-role') === 'admin' ? next() : void res.sendStatus(403);
  registerEmailAttribution(app, auth, admin, f.service);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const oldOrigin = process.env.ALLOWED_ORIGIN; process.env.ALLOWED_ORIGIN = base;
  try {
    const post = (origin?: string, body: unknown = { messageId: 'email_01_en', visitId, consent: true }) => fetch(base + '/api/public/email-attribution/visit', {
      method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
    });
    assert.equal((await post()).status, 403); assert.equal((await post('https://evil.invalid')).status, 403);
    assert.equal((await post(base, { messageId: 'email_01_en', visitId, consent: false })).status, 400);
    assert.equal(f.visits.size, 0);
    const response = await post(base);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const receipt = await response.json(); assert.match(receipt.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal((await fetch(base + '/api/admin/email-attribution')).status, 401);
    assert.equal((await fetch(base + '/api/admin/email-attribution', { headers: { 'x-test-role': 'staff' } })).status, 403);
    const report = await fetch(base + '/api/admin/email-attribution', { headers: { 'x-test-role': 'admin' } });
    assert.equal(report.status, 200); assert.equal(report.headers.get('cache-control'), 'no-store, private');
    assert.doesNotMatch(await report.text(), /token|visitId|account-|private-database-error/);
    const invalid = await fetch(base + '/api/admin/email-attribution?from=invalid', { headers: { 'x-test-role': 'admin' } });
    assert.equal(invalid.status, 400);
    for (let i = 0; i < 28; i++) await post(base);
    assert.equal((await post(base)).status, 429);
  } finally {
    if (oldOrigin === undefined) delete process.env.ALLOWED_ORIGIN; else process.env.ALLOWED_ORIGIN = oldOrigin;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
