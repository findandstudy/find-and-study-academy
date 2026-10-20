import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';

test('existing integration routes block reserved Google changes and preserve other-provider testing', async () => {
  process.env.DATABASE_URL = 'postgresql://isolated:isolated@127.0.0.1:1/isolated';
  const { registerRoutes } = await import('./routes');
  const { storage } = await import('./storage');
  const { pool } = await import('./db');
  const original = { getUser: storage.getUser, getIntegrationById: storage.getIntegrationById,
    testIntegrationConnection: storage.testIntegrationConnection, createAnalyticsMetric: storage.createAnalyticsMetric, query: pool.query };
  let genericTests = 0;
  storage.getUser = async () => ({ id: 'qa-admin', role: 'admin', status: 'active', email: 'admin@example.invalid', name: 'QA' }) as any;
  storage.getIntegrationById = async id => ({ id, name: id === 'google' ? 'google_analytics' : 'other_provider', enabled: false }) as any;
  storage.testIntegrationConnection = async () => { genericTests++; return { success: true, message: 'Existing provider test result', status: 'success' }; };
  storage.createAnalyticsMetric = async input => {
    assert.deepEqual(JSON.parse(input.metricValue!), { method: 'POST', path: '/api/admin/integrations/other/test', status: 200 });
    return { ...input, id: 'isolated-audit' } as any;
  };
  (pool as any).query = async (sql: string) => {
    assert.equal(sql, 'SELECT role FROM users WHERE id=$1', 'only the auth role lookup may reach storage');
    return { rows: [{ role: 'admin' }] };
  };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { (req as any).session = { userId: 'qa-admin' }; next(); });
  const server = await registerRoutes(app);
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    for (const [method, url, body] of [
      ['POST', '/api/admin/integrations', { name: 'google_analytics', type: 'analytics', apiKey: 'not-used' }],
      ['PUT', '/api/admin/integrations/google', { enabled: true }],
      ['PUT', '/api/admin/integrations/other', { name: 'google_search_console' }],
      ['POST', '/api/admin/integrations/google/test', {}],
      ['POST', '/api/admin/integrations/google/enable', {}],
      ['DELETE', '/api/admin/integrations/google', {}],
    ] as const) {
      const response = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 400, `${method} ${url}`);
    }
    assert.equal(genericTests, 0, 'Google never receives a mock connection success');
    const response = await fetch(base + '/api/admin/integrations/other/test', { method: 'POST' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).testResult.message, 'Existing provider test result');
    assert.equal(genericTests, 1);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    storage.getUser = original.getUser;
    storage.getIntegrationById = original.getIntegrationById;
    storage.testIntegrationConnection = original.testIntegrationConnection;
    storage.createAnalyticsMetric = original.createAnalyticsMetric;
    (pool as any).query = original.query;
    await pool.end();
  }
});
