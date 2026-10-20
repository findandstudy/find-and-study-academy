import assert from 'node:assert/strict';
import { test } from 'node:test';
import crypto from 'node:crypto';
import express from 'express';
import { signEmailAttribution } from './email-attribution';

// Actual normal/promo route handlers, fixture-only transactional storage, and
// no administrator recipients: no database connection or email delivery occurs.
test('only committed normal and promo signups record attribution; retries and optional failures preserve core behavior', async context => {
  process.env.DATABASE_URL = 'postgresql://isolated:isolated@127.0.0.1:1/isolated';
  const oldSecret = process.env.SESSION_SECRET; process.env.SESSION_SECRET = 'isolated-signup-attribution-secret';
  context.mock.method(console, 'error', () => {});
  const { registerRoutes } = await import('./routes');
  const { storage } = await import('./storage');
  const { db, pool } = await import('./db');
  const { users: userTable, agencies: agencyTable } = await import('@shared/schema');
  const originals = { getUsers: storage.getUsers, getUser: storage.getUser, transaction: db.transaction, query: pool.query, connect: pool.connect };
  let users: any[] = [], agencies: any[] = [], members: any[] = [], failUser = false, failAttribution = false;
  let snapshot: any;
  const registrations = new Set<string>();
  const challenge = new Map<string, string>();
  const campaignId = '20000000-0000-4000-8000-000000000001';
  const visitId = '20000000-0000-4000-8000-000000000002';
  const createdAt = Date.now();
  const token = signEmailAttribution({ v: 1, messageId: 'email_01_en', visitId, createdAt }, process.env.SESSION_SECRET);
  const columnTypes: Record<string, string> = { id: 'uuid', user_id: 'character varying', message_id: 'text', visit_id: 'uuid', created_at: 'timestamp with time zone' };
  const columns = [ ['academy_email_visits', ['id', 'message_id', 'created_at']], ['academy_email_registrations', ['user_id', 'message_id', 'visit_id', 'created_at']] ] as const;
  const constraints = ['academy_email_visits_pkey', 'academy_email_visits_message_id_check', 'academy_email_registrations_pkey',
    'academy_email_registrations_user_id_fkey', 'academy_email_registrations_visit_id_fkey', 'academy_email_registrations_message_id_check'];
  const fixtureQuery = async (sql: string, values: any[] = []): Promise<any> => {
    if (sql === 'BEGIN') { snapshot = { users: [...users], agencies: [...agencies], members: [...members], challenges: new Map(challenge) }; return { rows: [] }; }
    if (sql === 'COMMIT') return { rows: [] };
    if (sql === 'ROLLBACK') { users = snapshot.users; agencies = snapshot.agencies; members = snapshot.members; challenge.clear(); for (const entry of snapshot.challenges) challenge.set(...entry); return { rows: [] }; }
    if (sql.startsWith('SELECT name, enabled, settings FROM integrations')) {
      if (failAttribution) throw new Error('isolated analytics unavailable');
      return { rows: [{ name: 'google_analytics', enabled: true, settings: '{"enabled":true,"measurementId":"G-FIXTURE123","propertyId":""}' }] };
    }
    if (sql.includes('information_schema.columns')) return { rows: columns.flatMap(([table_name, keys]) => keys.map(column_name => ({ table_name, column_name, data_type: columnTypes[column_name], is_nullable: 'NO' }))) };
    if (sql.includes('SELECT conname')) return { rows: constraints.map(conname => ({ conname })) };
    if (sql.startsWith('INSERT INTO academy_email_registrations')) {
      assert(users.some(user => user.id === values[0]), 'source attribution must follow the committed user insert');
      if (registrations.has(values[0])) return { rows: [] };
      registrations.add(values[0]); return { rows: [{ user_id: values[0] }] };
    }
    if (sql.startsWith('UPDATE academy_email_challenges SET attempts')) return { rows: challenge.has(values[0]) ? [{ code_hash: challenge.get(values[0]), campaign_id: campaignId }] : [] };
    if (sql.startsWith('SELECT * FROM academy_campaigns')) return { rows: [{ id: campaignId, enabled: true, expires_at: new Date(Date.now() + 86400_000), max_uses: 100, access_days: 180 }] };
    if (sql.startsWith('SELECT count(*)::int AS n FROM academy_campaign_members')) return { rows: [{ n: members.length }] };
    if (sql.startsWith('DELETE FROM academy_email_challenges')) { const found = challenge.get(values[0]) === values[1]; if (found) challenge.delete(values[0]); return { rows: found ? [{ email: values[0] }] : [] }; }
    if (sql.startsWith('INSERT INTO agencies')) { agencies.push({ id: values[0], name: values[1], status: 'pending' }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO users')) {
      if (failUser) throw new Error('isolated user insert failed');
      if (users.some(user => user.email === values[1])) throw Object.assign(new Error('isolated duplicate'), { code: '23505' });
      users.push({ id: values[0], email: values[1], status: 'inactive', agencyId: values[7], role: 'agent', emailNotifications: false }); return { rows: [] };
    }
    if (sql.startsWith('INSERT INTO academy_campaign_members')) { members.push({ user_id: values[0], campaign_id: values[1] }); return { rows: [] }; }
    throw new Error('Unexpected isolated signup SQL: ' + sql);
  };
  (pool as any).query = fixtureQuery;
  (pool as any).connect = async () => ({ query: fixtureQuery, release() {} });
  storage.getUsers = async () => users;
  storage.getUser = async id => users.find(user => user.id === id);
  (db as any).transaction = async (callback: any) => {
    const pendingUsers: any[] = [], pendingAgencies: any[] = [];
    const result = await callback({ insert: (table: unknown) => ({ values: (value: any) => ({ returning: async () => {
      if (table === userTable) {
        if (failUser) throw new Error('isolated normal insert failed');
        const row = { ...value, emailNotifications: false }; pendingUsers.push(row); return [row];
      }
      assert.equal(table, agencyTable); pendingAgencies.push(value); return [value];
    } }) }) });
    users.push(...pendingUsers); agencies.push(...pendingAgencies); return result;
  };
  const app = express(); app.use(express.json());
  const server = await registerRoutes(app);
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const input = { name: 'Fixture Agent', email: 'normal@example.invalid', password: 'isolated-test-password', agencyName: 'Fixture Agency', country: 'TR', phone: '+905551234567', languagePreference: 'en', emailAttributionToken: token };
    const signup = (body: any) => fetch(base + '/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await signup(input)).status, 201); assert.equal(registrations.size, 1);
    assert.equal((await signup(input)).status, 409); assert.equal(registrations.size, 1);
    failUser = true;
    assert.equal((await signup({ ...input, email: 'failure@example.invalid' })).status, 500);
    assert.equal(users.length, 1); assert.equal(agencies.length, 1); assert.equal(registrations.size, 1);
    failUser = false;
    const promo = { ...input, email: 'promo@example.invalid', promoCode: 'FIXTURE123', verificationCode: '123456' };
    const addChallenge = (email: string) => challenge.set(email, crypto.createHmac('sha256', process.env.SESSION_SECRET!).update(email + ':123456').digest('hex'));
    addChallenge(promo.email);
    assert.equal((await signup({ ...promo, verificationCode: '000000' })).status, 400); assert.equal(registrations.size, 1);
    assert.equal((await signup(promo)).status, 201); assert.equal(members.length, 1); assert.equal(registrations.size, 2);
    assert.equal((await signup(promo)).status, 400); assert.equal(registrations.size, 2);
    addChallenge('rollback@example.invalid'); failUser = true;
    assert.equal((await signup({ ...promo, email: 'rollback@example.invalid' })).status, 500);
    assert.equal(members.length, 1); assert.equal(agencies.length, 2); assert.equal(registrations.size, 2);
    failUser = false; failAttribution = true;
    assert.equal((await signup({ ...input, email: 'optional-failure@example.invalid' })).status, 201);
    addChallenge('optional-promo@example.invalid');
    assert.equal((await signup({ ...promo, email: 'optional-promo@example.invalid' })).status, 201);
    assert.equal(users.length, 4); assert.equal(members.length, 2); assert.equal(registrations.size, 2);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    storage.getUsers = originals.getUsers; storage.getUser = originals.getUser; (db as any).transaction = originals.transaction;
    (pool as any).query = originals.query; (pool as any).connect = originals.connect;
    if (oldSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = oldSecret;
    await pool.end();
  }
});
