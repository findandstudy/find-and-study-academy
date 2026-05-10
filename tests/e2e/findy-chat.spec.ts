// Findy chat E2E regression suite — Task #45.
// Covers: account isolation, race-safe reset, admin-only debug panel,
// Turkish RAG retrieval (başvuru + yönetim).

import { test, expect, Page, BrowserContext, Route } from '@playwright/test';
import { Pool, neonConfig } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import ws from 'ws';

neonConfig.webSocketConstructor = ws as unknown as typeof globalThis.WebSocket;

const TEST_PASSWORD = 'TestPass123!';
const RUN_ID = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ADMIN_EMAIL = `admin.${RUN_ID}@e2e.findandstudy.test`;
const AGENT_EMAIL = `agent.${RUN_ID}@e2e.findandstudy.test`;
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5000';

interface HistoryItem { role: 'user' | 'assistant'; content: string }
interface ChatRequestBody { sessionId?: string; history?: HistoryItem[]; message?: string }
interface DebugChunk {
  id: string;
  sourceId: string;
  preview: string;
  score: number;
  matchedTerms: string[];
}
interface DebugPayload {
  queryTokens?: string[];
  expandedTerms?: string[];
  chunks?: DebugChunk[];
}
interface ChatResponse {
  success: boolean;
  message?: string;
  data?: { message?: string };
  debug?: DebugPayload;
}

let pool: Pool;
let adminId = '';
let agentId = '';
let kbSourceId = '';

test.beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set to run E2E tests');
  }
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);

  const ar = await pool.query(
    `INSERT INTO users (username, password, name, email, role, status, language_preference)
     VALUES ($1, $2, $3, $4, 'admin', 'active', 'tr') RETURNING id`,
    [`admin_${RUN_ID}`, hash, 'E2E Admin', ADMIN_EMAIL]
  );
  adminId = ar.rows[0].id;

  const gr = await pool.query(
    `INSERT INTO users (username, password, name, email, role, status, language_preference)
     VALUES ($1, $2, $3, $4, 'agent', 'active', 'tr') RETURNING id`,
    [`agent_${RUN_ID}`, hash, 'E2E Agent', AGENT_EMAIL]
  );
  agentId = gr.rows[0].id;

  // Seed two RAG chunks with unique RUN_ID markers so retrieval provenance
  // can be asserted independently of any other rows in the KB.
  const sr = await pool.query(
    `INSERT INTO knowledge_sources (name, type, file_type, status, uploaded_by)
     VALUES ($1, 'file', 'excel', 'active', $2) RETURNING id`,
    [`E2E KB ${RUN_ID}`, adminId]
  );
  kbSourceId = sr.rows[0].id;
  await pool.query(
    `INSERT INTO knowledge_chunks (source_id, content, keywords, metadata) VALUES
       ($1, $2, $3, $4),
       ($1, $5, $6, $7)`,
    [
      kbSourceId,
      `E2EMARKER_${RUN_ID}_APP: University application process — submit your application via the online portal with required documents.`,
      'application university admission process',
      JSON.stringify({ Country: 'Turkey', e2e: RUN_ID }),
      `E2EMARKER_${RUN_ID}_MGMT: Business management programs cover strategic management, project management and operations.`,
      'management business mba programs',
      JSON.stringify({ Country: 'Turkey', e2e: RUN_ID }),
    ]
  );
});

test.afterAll(async () => {
  if (pool) {
    await pool.query(
      `DELETE FROM findy_conversations WHERE session_id LIKE $1 OR user_id = ANY($2)`,
      [`%${RUN_ID}%`, [adminId, agentId]]
    );
    if (kbSourceId) {
      await pool.query('DELETE FROM knowledge_chunks WHERE source_id = $1', [kbSourceId]);
      await pool.query('DELETE FROM knowledge_sources WHERE id = $1', [kbSourceId]);
    }
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [
      [ADMIN_EMAIL, AGENT_EMAIL],
    ]);
    await pool.end();
  }
});

type Role = 'admin' | 'agent';

interface TestUser { id: string; email: string; role: Role; name: string }

function userFor(role: Role): TestUser {
  return role === 'admin'
    ? { id: adminId, email: ADMIN_EMAIL, role, name: 'E2E Admin' }
    : { id: agentId, email: AGENT_EMAIL, role, name: 'E2E Agent' };
}

async function newCtx(browser: import('@playwright/test').Browser) {
  // Pass baseURL explicitly so manually-created contexts resolve relative URLs.
  return browser.newContext({ baseURL: BASE_URL });
}

async function mockNoPopups(context: BrowserContext) {
  await context.route('**/api/popups/active', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, popups: [] }),
    });
  });
}

async function loginAs(context: BrowserContext, page: Page, role: Role) {
  await mockNoPopups(context);
  const u = userFor(role);
  // Use the browser context's request helper so the httpOnly fas.sid cookie
  // shares the same context as page navigations.
  const res = await context.request.post('/api/login', {
    headers: { 'x-playwright-test': '1' },
    data: { email: u.email, password: TEST_PASSWORD },
  });
  expect(res.status(), 'login should succeed').toBe(200);

  const sessionPayload = {
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      agencyId: null,
      profilePicture: null,
      languagePreference: 'tr',
    },
    role: u.role,
  };
  // Seed the React app's localStorage entry that findy-launcher reads.
  await page.addInitScript((payload) => {
    localStorage.setItem('fas_session', JSON.stringify(payload));
  }, sessionPayload);
}

async function logout(context: BrowserContext, page: Page) {
  await context.request.post('/api/logout');
  await page.evaluate(() => {
    localStorage.removeItem('fas_session');
    localStorage.removeItem('findy-last-user');
  });
}

async function openChat(page: Page) {
  await page.locator('#findy-button').click();
  await expect(page.locator('#findy-chat')).toBeVisible();
}

interface MockChatOptions {
  bodyMarker: string;
  delayMs?: number;
  debug?: DebugPayload;
  onRequest?: (postBody: ChatRequestBody) => void;
}

async function mockChatReply(context: BrowserContext, opts: MockChatOptions) {
  await context.route('**/api/chat', async (route: Route) => {
    let parsed: ChatRequestBody = {};
    try {
      parsed = JSON.parse(route.request().postData() || '{}') as ChatRequestBody;
    } catch { /* ignore */ }
    if (opts.onRequest) opts.onRequest(parsed);
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: opts.bodyMarker,
        data: { message: opts.bodyMarker },
        ...(opts.debug ? { debug: opts.debug } : {}),
      }),
    });
  });
}

async function sendChatMessage(page: Page, text: string) {
  await page.locator('#findy-input').fill(text);
  await page.locator('#findy-send').click();
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Findy chat hesap izolasyonu', () => {
  test('admin → logout → agent: bubble\'lar, sessionId VE conversationHistory sıfırlanır', async ({ browser }) => {
    const context = await newCtx(browser);
    interface CapturedReq { sessionId: string; history: HistoryItem[]; userId: string }
    const requests: CapturedReq[] = [];

    await context.route('**/api/chat', async (route: Route) => {
      let body: ChatRequestBody = {};
      try { body = JSON.parse(route.request().postData() || '{}') as ChatRequestBody; } catch { /* ignore */ }
      const userId = route.request().headers()['x-user-id'] || '';
      requests.push({ sessionId: body.sessionId || '', history: body.history || [], userId });
      const marker = userId === adminId ? 'ADMIN_REPLY_MARKER' : 'AGENT_REPLY_MARKER';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: marker, data: { message: marker } }),
      });
    });

    try {
      const page = await context.newPage();
      await loginAs(context, page, 'admin');
      await page.goto('/');
      await openChat(page);

      await sendChatMessage(page, 'admin tarafından gönderildi');
      await expect(page.locator('.findy-message.user').last()).toContainText('admin tarafından gönderildi');
      await expect(page.locator('.findy-message.bot').last()).toContainText('ADMIN_REPLY_MARKER');

      // Second admin send → history must contain the first admin turn.
      await sendChatMessage(page, 'admin ikinci sorgusu');
      const adminSecondReq = requests[requests.length - 1];
      expect(
        JSON.stringify(adminSecondReq.history).toLowerCase(),
        'admin oturumunda history admin mesajını içermeli'
      ).toContain('admin tarafından gönderildi');

      await logout(context, page);
      await loginAs(context, page, 'agent');
      await page.goto('/');
      await openChat(page);

      await expect(
        page.locator('.findy-message.user', { hasText: 'admin tarafından gönderildi' })
      ).toHaveCount(0);
      await expect(
        page.locator('.findy-message.bot', { hasText: 'ADMIN_REPLY_MARKER' })
      ).toHaveCount(0);

      await sendChatMessage(page, 'acente sorgusu');
      await expect(page.locator('.findy-message.bot').last()).toContainText('AGENT_REPLY_MARKER');
      const agentReq = requests[requests.length - 1];
      expect(agentReq.userId).toBe(agentId);
      expect(agentReq.sessionId).not.toBe(adminSecondReq.sessionId);
      // The critical assertion: agent's first request must carry no admin history.
      expect(
        agentReq.history.length,
        `acente ilk isteğinde history dolu — admin verisi sızıyor: ${JSON.stringify(agentReq.history)}`
      ).toBe(0);
      expect(JSON.stringify(agentReq.history).toLowerCase()).not.toContain('admin tarafından gönderildi');
    } finally {
      await context.close();
    }
  });

  test('cross-tab logout: storage event chat\'i resetler', async ({ browser }) => {
    const context = await newCtx(browser);
    await mockChatReply(context, { bodyMarker: 'TAB1_REPLY' });

    const tab1 = await context.newPage();
    await loginAs(context, tab1, 'admin');
    await tab1.goto('/');
    await openChat(tab1);
    await sendChatMessage(tab1, 'birinci tab mesajı');
    await expect(tab1.locator('.findy-message.bot').last()).toContainText('TAB1_REPLY');

    const tab2 = await context.newPage();
    await loginAs(context, tab2, 'agent');
    await tab2.goto('/');

    await tab1.bringToFront();
    await tab1.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'fas_session' }));
    });
    await expect(
      tab1.locator('.findy-message.user', { hasText: 'birinci tab mesajı' })
    ).toHaveCount(0);

    await context.close();
  });
});

test.describe('Findy chat debug panel gating', () => {
  const fakeDebug: DebugPayload = {
    queryTokens: ['başvuru'],
    expandedTerms: ['application'],
    chunks: [{ id: 'fake-1', sourceId: 'fake-1', score: 5, matchedTerms: ['application'], preview: 'Sample chunk preview' }],
  };

  test('admin: server debug payload geldiğinde panel render edilir', async ({ browser }) => {
    const context = await newCtx(browser);
    await mockChatReply(context, { bodyMarker: 'admin debug görür', debug: fakeDebug });

    const page = await context.newPage();
    await loginAs(context, page, 'admin');
    await page.goto('/');
    await openChat(page);
    await sendChatMessage(page, 'başvuru nasıl yapılır');
    await expect(page.locator('.findy-debug-panel')).toBeVisible();
    await expect(page.locator('.findy-debug-toggle')).toContainText('Debug');

    await context.close();
  });

  test('agent: sahte debug payload enjekte edilse bile panel render edilmez', async ({ browser }) => {
    const context = await newCtx(browser);
    // Server normally never sends `debug` to agents; the mock forces it
    // anyway to verify the client-side role guard rejects it unconditionally.
    await mockChatReply(context, { bodyMarker: 'acente yanıt', debug: fakeDebug });

    const page = await context.newPage();
    await loginAs(context, page, 'agent');
    await page.goto('/');
    await openChat(page);
    await sendChatMessage(page, 'başvuru nasıl yapılır');
    await expect(page.locator('.findy-message.bot').last()).toContainText('acente yanıt');
    await expect(page.locator('.findy-debug-panel')).toHaveCount(0);

    await context.close();
  });
});

test.describe('Findy chat race koşulu', () => {
  test('uçuşta yanıt, kullanıcı değişiminden sonra DOM\'a düşmez', async ({ browser }) => {
    const context = await newCtx(browser);
    await context.route('**/api/chat', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'STALE_REPLY_FROM_PREVIOUS_USER',
          data: { message: 'STALE_REPLY_FROM_PREVIOUS_USER' },
        }),
      });
    });

    const page = await context.newPage();
    await loginAs(context, page, 'admin');
    await page.goto('/');
    await openChat(page);

    await sendChatMessage(page, 'yanıt gelmeden önce kullanıcı değişecek');
    await expect(
      page.locator('.findy-message.bot', { hasText: 'STALE_REPLY_FROM_PREVIOUS_USER' })
    ).toHaveCount(0);

    await logout(context, page);
    await loginAs(context, page, 'agent');
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'fas_session' }));
    });

    await page.waitForTimeout(2000);
    await expect(
      page.locator('.findy-message.bot', { hasText: 'STALE_REPLY_FROM_PREVIOUS_USER' })
    ).toHaveCount(0);

    await context.close();
  });
});

// ── Turkish RAG retrieval (deterministic against seeded chunks) ────────────

test.describe('Findy chat Türkçe RAG genişletmesi (API)', () => {
  function assertSeedHit(chunks: DebugChunk[], suffix: 'APP' | 'MGMT') {
    const marker = `E2EMARKER_${RUN_ID}_${suffix}`;
    const seedHit = chunks.find(
      (c) => c.sourceId === kbSourceId && typeof c.preview === 'string' && c.preview.includes(marker)
    );
    expect(
      seedHit,
      `seed chunk (sourceId=${kbSourceId}, marker=${marker}) retrieve edilmedi; geldi: ${JSON.stringify(chunks)}`
    ).toBeDefined();
  }

  function assertExpansion(debug: DebugPayload, expected: string, chunks: DebugChunk[]) {
    const terms = (debug.expandedTerms || []).join(' ').toLowerCase();
    const hasInExpanded = terms.includes(expected);
    const hasInMatched = chunks.some((c) =>
      (c.matchedTerms || []).some((t) => t.toLowerCase().includes(expected))
    );
    expect(
      hasInExpanded || hasInMatched,
      `Türkçe expansion '${expected}' equivalent'ini içermeli; expandedTerms=${terms}`
    ).toBe(true);
  }

  test('admin sorgusu "başvuru" — TR→EN expansion + seeded source provenance', async ({ request }) => {
    const loginRes = await request.post('/api/login', {
      headers: { 'x-playwright-test': '1' },
      data: { email: ADMIN_EMAIL, password: TEST_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);

    // Embedding the unique marker in the query lets only the seed chunk
    // top-rank, while `başvuruyu` still exercises TR→EN expansion.
    const chatRes = await request.post('/api/chat', {
      headers: { 'x-user-id': adminId, 'x-playwright-test': '1' },
      data: {
        message: `başvuruyu nasıl başlatırım E2EMARKER_${RUN_ID}_APP`,
        sessionId: 'rag-test-app-' + RUN_ID,
        history: [],
      },
    });
    expect(chatRes.ok(), `admin /api/chat 2xx dönmeli, geldi: ${chatRes.status()}`).toBe(true);
    const json = (await chatRes.json()) as ChatResponse;
    expect(json.success).toBe(true);
    expect(json.debug, 'admin için debug payload dönmeli').toBeDefined();
    const debug = json.debug as DebugPayload;
    const chunks = debug.chunks || [];
    expect((debug.queryTokens || []).join(' ').toLowerCase()).toContain('basvuru');
    assertExpansion(debug, 'application', chunks);
    expect(chunks.length, 'KB seed chunk retrieve edilmedi').toBeGreaterThan(0);
    assertSeedHit(chunks, 'APP');
  });

  test('admin sorgusu "yönetim" — TR→EN expansion + seeded source provenance', async ({ request }) => {
    const loginRes = await request.post('/api/login', {
      headers: { 'x-playwright-test': '1' },
      data: { email: ADMIN_EMAIL, password: TEST_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);

    const chatRes = await request.post('/api/chat', {
      headers: { 'x-user-id': adminId, 'x-playwright-test': '1' },
      data: {
        message: `yönetim programları E2EMARKER_${RUN_ID}_MGMT`,
        sessionId: 'rag-test-mgmt-' + RUN_ID,
        history: [],
      },
    });
    expect(chatRes.ok(), `admin /api/chat 2xx dönmeli, geldi: ${chatRes.status()}`).toBe(true);
    const json = (await chatRes.json()) as ChatResponse;
    expect(json.success).toBe(true);
    expect(json.debug).toBeDefined();
    const debug = json.debug as DebugPayload;
    const chunks = debug.chunks || [];
    expect((debug.queryTokens || []).join(' ').toLowerCase()).toContain('yonetim');
    assertExpansion(debug, 'management', chunks);
    expect(chunks.length, 'KB seed chunk retrieve edilmedi').toBeGreaterThan(0);
    assertSeedHit(chunks, 'MGMT');
  });

  test('agent sorgusu için sunucu yanıtı debug payload İÇERMEZ', async ({ request }) => {
    const loginRes = await request.post('/api/login', {
      headers: { 'x-playwright-test': '1' },
      data: { email: AGENT_EMAIL, password: TEST_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);

    const chatRes = await request.post('/api/chat', {
      headers: { 'x-user-id': agentId, 'x-playwright-test': '1' },
      data: {
        message: 'yönetim programları',
        sessionId: 'rag-test-agent-' + RUN_ID,
        history: [],
      },
    });
    expect(chatRes.ok(), `agent /api/chat 2xx dönmeli, geldi: ${chatRes.status()}`).toBe(true);
    const json = (await chatRes.json()) as ChatResponse;
    expect(json.success).toBe(true);
    expect(json.debug, 'sunucu acente için debug payload sızdırıyor').toBeUndefined();
  });
});
