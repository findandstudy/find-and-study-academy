import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';

// No real database or mail account is used. Exercise the actual HTTP routes,
// session middleware and password hashing with isolated transactional storage.
test('self-registration waits for administrator approval, blocks login, then allows approved agents and rolls back failures', async () => {
  process.env.DATABASE_URL = 'postgresql://isolated:isolated@127.0.0.1:1/isolated';
  const { registerRoutes } = await import('./routes');
  const { storage } = await import('./storage');
  const { db, pool } = await import('./db');
  const { users: userTable, agencies: agencyTable } = await import('@shared/schema');
  const savedMethods = { getUsers: storage.getUsers, getUser: storage.getUser, transaction: db.transaction };
  let users: any[] = [], agencies: any[] = [], failUserInsert = false;
  // Model the ordinary account's campaign lookups without opening a real DB connection.
  // Campaign-specific membership/device behavior is covered by the isolated PG suite.
  const savedPool = { query: pool.query, connect: pool.connect };
  const fixtureQuery = async (sql: string, values: any[] = []) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
    if (sql === 'SELECT id,role,status FROM users WHERE id=$1 FOR UPDATE' || sql === 'SELECT role FROM users WHERE id=$1') {
      const user = users.find(u => u.id === values[0]);
      return { rows: user ? [{ id: user.id, role: user.role, status: user.status }] : [], rowCount: user ? 1 : 0 };
    }
    if (sql === 'SELECT access_until FROM academy_campaign_members WHERE user_id=$1') return { rows: [], rowCount: 0 };
    throw new Error('Unexpected isolated registration SQL: ' + sql);
  };
  (pool as any).query = fixtureQuery;
  (pool as any).connect = async () => ({ query: fixtureQuery, release() {} });
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
    assert.equal(result.pending, true);
    assert.equal(result.user, undefined);
    assert.equal(users[0].languagePreference, 'uk');
    assert.equal(users[0].status, 'inactive');
    assert.equal(agencies[0].status, 'pending');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await fetch(base + '/api/me')).status, 401);
    const login = () => fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qa@example.invalid', password: input.password }) });
    const denied = await login();
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).pending, true);
    users[0].status = 'active';
    agencies[0].status = 'active';
    assert.equal(users[0].email, 'qa@example.invalid');
    assert.equal(users[0].agencyId, agencies[0].id);
    assert.notEqual(users[0].password, input.password);
    assert(await bcrypt.compare(input.password, users[0].password));
    const approvedLogin = await login();
    assert.equal(approvedLogin.status, 200);
    const cookie = approvedLogin.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    assert(cookie);
    const me = await fetch(base + '/api/me', { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.id, users[0].id);
    assert.equal((await fetch(base + '/api/admin/quizzes', { headers: { cookie } })).status, 403);
    // In-memory test role only: invalid grading keys/duplicate IDs must be
    // rejected before the quiz write API ever touches persistence.
    users[0].role = 'admin';
    const invalidQuiz = { id: 'qa-invalid-quiz', title: 'QA Quiz', courseId: 'course-1', isFinal: false };
    for (const questions of [
      [{ id: 'q1', type: 'mcq', text: 'Pick one', options: ['A', 'B'], answerIndex: 2 }],
      [{ id: 'q1', type: 'boolean', text: 'First', answer: true }, { id: 'q1', type: 'boolean', text: 'Second', answer: false }],
    ]) {
      const invalid = await fetch(base + '/api/admin/quizzes', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ ...invalidQuiz, questions: JSON.stringify(questions) }) });
      assert.equal(invalid.status, 400);
    }
    users[0].role = 'agent';
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
    (pool as any).query = savedPool.query;
    (pool as any).connect = savedPool.connect;
    await pool.end();
  }
});
