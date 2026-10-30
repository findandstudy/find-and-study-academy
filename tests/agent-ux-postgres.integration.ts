/** Explicit disposable-DB integration runner; never accepts a production URL. */
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';

const target = new URL(process.env.DATABASE_URL || 'http://invalid');
assert.equal(target.hostname, 'academy-ux-test-pg');
assert.equal(target.pathname, '/academy_ux_test');
assert.equal(process.env.ACADEMY_UX_DISPOSABLE, '1');
assert.notEqual(process.env.NODE_ENV, 'production');
const { pool } = await import('../server/db');
const { registerRoutes } = await import('../server/routes');
const pg = pool as any;
const identity = (await pg.query('SELECT current_database() AS db, version() AS version')).rows[0];
assert.equal(identity.db, 'academy_ux_test');
await pg.query(`CREATE TABLE IF NOT EXISTS academy_campaign_members(user_id varchar PRIMARY KEY, access_until timestamptz)`);
await pg.query(`INSERT INTO agencies(id,name,country,city,status) VALUES
 ('ux-agency-a','Synthetic A','TR','Ankara','active'),('ux-agency-b','Synthetic B','LV','Riga','active')`);
await pg.query(`INSERT INTO users(id,username,password,name,email,role,status,agency_id) VALUES
 ('ux-agent-a','ux-a','unused','Synthetic A','a@example.invalid','agent','active','ux-agency-a'),
 ('ux-agent-b','ux-b','unused','Synthetic B','b@example.invalid','agent','active','ux-agency-b'),
 ('ux-admin','ux-admin','unused','Synthetic Admin','admin@example.invalid','admin','active',null),
 ('ux-inactive','ux-inactive','unused','Synthetic Inactive','inactive@example.invalid','agent','inactive','ux-agency-a')`);
await pg.query(`UPDATE users SET country='TR',phone='+905551234567'`);
await pg.query(`UPDATE agencies SET contact_email='agency@example.invalid',primary_contact_email='agency@example.invalid',contact_phone='+905551234567',phone='+905551234567'`);
await pg.query(`INSERT INTO countries(id,name,code,status) VALUES ('ux-lv','Latvia','LV','active')`);
await pg.query(`INSERT INTO certificates(id,user_id,course_id,score_percent,code) VALUES
 ('ux-cert-a','ux-agent-a','course-ux-lv',90,'UX-ONLY-A'),('ux-cert-b','ux-agent-b','course-ux-lv',80,'UX-ONLY-B')`);
const app = express();
app.use(express.json());
app.use(session({ secret: 'disposable-synthetic-session-only', resave: false, saveUninitialized: false }));
// Harness-only session creation; absent from the application and production bundle.
app.post('/__test/session', (req, res) => { (req.session as any).userId = req.body.user; res.json({ success: true }); });
const server = await registerRoutes(app);
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
let passed = 0;
const ok = () => passed++;
const cookieFor = async (user: string) => {
  const r = await fetch(base + '/__test/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user }) });
  return r.headers.get('set-cookie')!.split(';')[0];
};
const request = (url: string, cookie = '', method = 'GET', body?: unknown, extra = {}) => fetch(base + url, {
  method, headers: { cookie, 'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body),
});
try {
  assert.equal((await request('/api/certificates')).status, 401); ok();
  assert.equal((await request('/api/certificates', '', 'GET', undefined, { 'x-user-id': 'ux-agent-a', 'x-user-role': 'admin' })).status, 401); ok();
  const a = await cookieFor('ux-agent-a'), b = await cookieFor('ux-agent-b'), admin = await cookieFor('ux-admin');
  const ca = await (await request('/api/certificates', a)).json();
  assert.ok(ca.certificates, JSON.stringify(ca));
  assert.deepEqual(ca.certificates.map((c: any) => c.id), ['ux-cert-a']);
  assert.equal(ca.certificates[0].course.title, 'Latvia — Agent Training'); ok();
  const cb = await (await request('/api/certificates', b)).json();
  assert.deepEqual(cb.certificates.map((c: any) => c.id), ['ux-cert-b']); ok();
  assert.equal((await request('/api/admin/certificates', a)).status, 403); ok();
  const all = await (await request('/api/admin/certificates', admin)).json();
  assert.equal(all.certificates.length, 2);
  assert.ok(all.certificates.every((c: any) => c.course?.title === ca.certificates[0].course.title)); ok();
  const verified = await (await request('/api/verify?code=UX-ONLY-A')).json();
  assert.equal(verified.certificate.course.id, 'course-ux-lv'); ok();
  const unknown = await request('/api/verify?code=UX-UNKNOWN');
  assert.equal(unknown.status, 404); ok();
  assert.equal((await request('/api/agency', a, 'PUT', { country: 'lv', city: ' Riga ' })).status, 200);
  const own = await (await request('/api/agency', a)).json();
  assert.equal(own.agency.country, 'LV'); assert.equal(own.agency.city, 'Riga'); ok();
  for (const body of [{ id: 'ux-agency-b', city: 'Changed' }, { agencyId: 'ux-agency-b' }, { status: 'pending' }, { country: 'XX' }, { city: 'x'.repeat(161) }]) {
    assert.equal((await request('/api/agency', a, 'PUT', body)).status, 400); ok();
  }
  assert.equal((await request('/api/agency', admin, 'PUT', { city: 'Changed' })).status, 403); ok();
  const other = (await pg.query(`SELECT city,status FROM agencies WHERE id='ux-agency-b'`)).rows[0];
  assert.deepEqual(other, { city: 'Riga', status: 'active' }); ok();
  const inactive = await cookieFor('ux-inactive');
  assert.equal((await request('/api/certificates', inactive)).status, 403); ok();
  assert.equal(Number((await pg.query('SELECT count(*) AS n FROM certificates')).rows[0].n), 2); ok();
  console.log(JSON.stringify({ status: 'PASS', assertions: passed, database: identity.db, postgres: identity.version.split(',')[0], realRoutes: true, productionData: false }));
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await pg.end();
}
