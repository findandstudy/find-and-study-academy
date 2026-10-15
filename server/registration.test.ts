import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';

// No real database or mail account is used. Exercise the actual HTTP routes,
// session middleware and password hashing with isolated transactional storage.
test('self-registration creates an active agent session, denies admin access and rolls back failures', async () => {
  process.env.DATABASE_URL ||= 'postgresql://isolated:isolated@127.0.0.1:1/isolated';
  const { registerRoutes } = await import('./routes');
  const { storage } = await import('./storage');
  const { db, pool } = await import('./db');
  const { users: userTable, agencies: agencyTable } = await import('@shared/schema');
  const savedMethods = { getUsers: storage.getUsers, getUser: storage.getUser, transaction: db.transaction };
  let users: any[] = [], agencies: any[] = [], failUserInsert = false;
  storage.getUsers = async () => users;
  storage.getUser = async id => users.find(user => user.id === id);
  (db as any).transaction = async (callback: any) => {
    const stagedUsers: any[] = [], stagedAgencies: any[] = [];
    const result = await callback({ insert: (table: unknown) => ({ values: (value: any) => ({ returning: async () => {
      if (table === userTable) {
        if (failUserInsert) throw new Error('Simulated insert failure');
        // Disable notifications only in the test adapter, preventing email.
        const row = { ...value, emailNotifications: false };
        stagedUsers.push(row); return [row];
      }
      assert.equal(table, agencyTable); stagedAgencies.push(value); return [value];
    } }) }) });
    users.push(...stagedUsers); agencies.push(...stagedAgencies);
    return result;
  };
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'isolated-registration-test-secret', resave: false, saveUninitialized: false }));
  const server = await registerRoutes(app);
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const input = { name: 'QA Agent', email: '  QA@example.invalid ', password: 'isolated-test-password', agencyName: 'QA Agency', country: 'tr', phone: '+90 555 000 0000', languagePreference: 'uk' };
    const signup = (body: unknown) => fetch(base + '/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await signup({ ...input, role: 'admin' })).status, 400);
    assert.equal(users.length, 0);
    const response = await signup(input);
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.pending, false);
    assert.equal(result.user.role, 'agent');
    assert.equal(result.user.languagePreference, 'uk');
    assert.equal(result.user.password, undefined);
    assert.equal(users[0].status, 'active');
    assert.equal(users[0].email, 'qa@example.invalid');
    assert.equal(users[0].agencyId, agencies[0].id);
    assert.notEqual(users[0].password, input.password);
    assert(await bcrypt.compare(input.password, users[0].password));
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    assert(cookie);
    const me = await fetch(base + '/api/me', { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.id, result.user.id);
    assert.equal((await fetch(base + '/api/admin/quizzes', { headers: { cookie } })).status, 403);
    assert.equal((await fetch(base + '/api/me')).status, 401);
    assert.equal((await signup({ ...input, email: 'QA@EXAMPLE.INVALID' })).status, 409);
    assert.equal(agencies.length, 1);
    users[0].status = 'inactive';
    assert.equal((await fetch(base + '/api/me', { headers: { cookie } })).status, 403);
    failUserInsert = true;
    assert.equal((await signup({ ...input, email: 'second@example.invalid' })).status, 500);
    assert.equal(agencies.length, 1, 'failed user insert must not leave an agency');
    assert.equal(users.length, 1);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    storage.getUsers = savedMethods.getUsers;
    storage.getUser = savedMethods.getUser;
    (db as any).transaction = savedMethods.transaction;
    await pool.end();
  }
});
