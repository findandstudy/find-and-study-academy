// Usage from the repository root: node tests/campaign-preview-api.test.cjs
// Runs the registered HTTP route with the real preview limiter and a read-only fixture pool.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve(__dirname, '../package.json'));
const ts = req('typescript');
const express = req('express');
const { z } = req('zod');
const file = path.resolve(__dirname, '../server/campaign-access.ts');
const now = Date.parse('2026-10-19T12:00:00Z');
const future = new Date(now + 86400000);
const hash = code => crypto.createHash('sha256').update(code).digest('hex');
const valid = {
  access_days: 180, expires_at: future, enabled: true, max_uses: 10, registrations: 9,
  // Extra data deliberately returned by the fixture must never make it into the response.
  id: 'private-id', label: 'Private label', code_hash: 'private-hash', recipients: ['private@example.invalid'],
};
const fixtures = new Map(Object.entries({
  'VALID-180': valid,
  EXPIRED: { ...valid, expires_at: new Date(now - 1) },
  BOUNDARY: { ...valid, expires_at: new Date(now) },
  DISABLED: { ...valid, enabled: false },
  FULLCODE: { ...valid, registrations: 10 },
  OVERFULL: { ...valid, registrations: 11 },
  [ 'A'.repeat(64) ]: { ...valid, access_days: 1 },
}).map(([code, row]) => [hash(code), row]));
const queries = [];
let queryFailure = false;
let signupLimitCalls = 0;
const pool = {
  async connect() { throw new Error('Preview must never open a transaction'); },
  async query(sql, params) {
    assert.match(sql, /^SELECT\b/i);
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK|FOR\s+UPDATE)\b/i);
    assert.doesNotMatch(sql, /SELECT\s+\*/i);
    assert.match(sql, /count\(\*\)::int FROM academy_campaign_members/);
    assert.deepEqual(Array.from(params).length, 1);
    assert.match(params[0], /^[0-9a-f]{64}$/);
    queries.push({ sql, params: Array.from(params) });
    if (queryFailure) throw new Error('Fixture unavailable');
    const row = fixtures.get(params[0]);
    return { rows: row ? [row] : [] };
  },
};
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  reportDiagnostics: true,
});
assert.equal(code.diagnostics.length, 0);
vm.runInNewContext(code.outputText, {
  exports: mod.exports, module: mod,
  require: name => {
    if (name === './db') return { pool };
    if (name === '@shared/signup-validation') return { publicSignupSchema: z.object({}) };
    if (name === './smtp-email') throw new Error('Preview must never send email');
    return req(name);
  },
  process, Buffer, setTimeout, clearTimeout,
  console: { ...console, error: () => {} },
  Date: class extends Date { static now() { return now; } },
}, { filename: file });
const app = express();
app.use(express.json());
const forbidAuth = () => { throw new Error('Public preview must not require authentication'); };
mod.exports.registerCampaignAccess(app, forbidAuth, forbidAuth, (_q, _s, next) => { signupLimitCalls++; next(); });
const rejected = { success: false, code: 'PROMO_INVALID_OR_EXPIRED', message: 'PROMO_INVALID_OR_EXPIRED' };
let server;
let passed = 0;
let requests = 0;
function check(name, fn) { fn(); passed++; console.log('PASS', name); }
(async () => {
  try {
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    async function preview(body) {
      requests++;
      const response = await fetch(base + '/api/public/campaign-preview', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return { status: response.status, data: await response.json(), headers: response.headers };
    }
    let response = await preview({ promoCode: 'VALID-180' });
    check('valid preview exposes exactly the approved public terms', () => {
      assert.equal(response.status, 200);
      assert.deepEqual(response.data, {
        success: true,
        campaign: {
          accessDays: 180, expiresAt: future.toISOString(), deviceLimit: 2,
          emailVerificationRequired: true, administratorApprovalRequired: true,
        },
      });
      for (const secret of ['private-id', 'Private label', 'private-hash', 'private@example.invalid', 'max_uses', 'registrations']) {
        assert.ok(!JSON.stringify(response.data).includes(secret));
      }
    });
    response = await preview({ promoCode: ' \tvalid-180\n ' });
    check('whitespace and case normalize to the same existing promo hash', () => {
      assert.equal(response.status, 200);
      assert.equal(queries.at(-1).params[0], hash('VALID-180'));
    });
    response = await preview({ promoCode: 'A'.repeat(64) });
    check('maximum valid code length and one-day offer remain supported', () => {
      assert.equal(response.status, 200);
      assert.equal(response.data.campaign.accessDays, 1);
    });
    for (const promoCode of ['EXPIRED', 'BOUNDARY', 'DISABLED', 'FULLCODE', 'OVERFULL', 'UNKNOWN']) {
      response = await preview({ promoCode });
      check(promoCode.toLowerCase() + ' uses the same generic non-success response', () => {
        assert.equal(response.status, 400);
        assert.deepEqual(response.data, rejected);
      });
    }
    const beforeInvalid = queries.length;
    for (const body of [{}, { promoCode: null }, { promoCode: '' }, { promoCode: 'SHORT' }, { promoCode: 'A'.repeat(65) }, { promoCode: 'INVALID!' }, { promoCode: 'CÖDE123' }, { promoCode: 123456 }, { promoCode: 'VALID-180', email: 'private@example.invalid' }]) {
      response = await preview(body);
      check('invalid input ' + JSON.stringify(body) + ' is generic and does not query', () => {
        assert.equal(response.status, 400);
        assert.deepEqual(response.data, rejected);
        assert.equal(queries.length, beforeInvalid);
      });
    }
    queryFailure = true;
    response = await preview({ promoCode: 'VALID-180' });
    check('database failure remains non-cacheable and discloses no query details', () => {
      assert.equal(response.status, 500);
      assert.deepEqual(response.data, { success: false, code: 'REQUEST_FAILED', message: 'REQUEST_FAILED' });
    });
    queryFailure = false;
    while (requests < 30) assert.equal((await preview({ promoCode: 'VALID-180' })).status, 200);
    const beforeLimit = queries.length;
    response = await preview({ promoCode: 'VALID-180' });
    check('dedicated limiter rejects request 31 before querying and never consumes signup quota', () => {
      assert.equal(response.status, 429);
      assert.equal(response.data.success, false);
      assert.equal(response.data.code, 'REQUEST_LIMIT_REACHED');
      assert.equal(queries.length, beforeLimit);
      assert.equal(signupLimitCalls, 0);
    });
    const signupResponse = await fetch(base + '/api/signup/email-code', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    check('signup still uses its supplied limiter after preview quota is exhausted', () => {
      assert.equal(signupResponse.status, 400);
      assert.equal(signupLimitCalls, 1);
    });
    check('every preview database operation is a parameterized unlocked SELECT', () => {
      assert.ok(queries.length > 0);
      assert.ok(queries.every(query => query.params.length === 1));
    });
    console.log('ALL', passed, 'CHECKS PASSED; no database, registration, challenge, audit, or email writes');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
