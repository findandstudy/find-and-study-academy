/**
 * Findy chat — uçtan-uca regresyon paketi (Task #45).
 *
 * Korunan davranışlar (Task #42'den):
 *   1. Hesap izolasyonu: admin → çıkış → acente girişi sonrası bir önceki
 *      kullanıcının bubble'ları DOM'dan ve conversationHistory'den temizlenir,
 *      yeni sessionId üretilir.
 *   2. Race güvenliği: bir mesaj uçuşta iken kullanıcı değişirse geç gelen
 *      yanıt yeni kullanıcının chat'ine düşmez (chatEpoch + AbortController).
 *   3. Debug paneli sadece admin için render edilir; sahte admin payload
 *      enjekte edilse bile acente client-side guard'ı reddeder.
 *   4. Türkçe RAG genişletmesi: `başvuru`, `yönetim` gibi sorgular
 *      expandTurkishQueryTerms üzerinden English equivalent'lere expand
 *      olur (debug.expandedTerms ile doğrulanır).
 *
 * Test verisi: her koşuda RUN_ID son ekiyle iki test kullanıcısı (admin +
 * agent) bcrypt-hashed parola ile users tablosuna eklenir; test sonu
 * `afterAll` ile silinir. Mevcut DB içeriği bozulmaz.
 *
 * NOT: Gerçek AI sağlayıcı çağrısı yapılmaz. RAG retrieval testi sunucunun
 * /api/chat yanıtındaki `debug` alanını okur (admin-only, sağlayıcı/n8n
 * sonucundan bağımsız olarak ekleniyor). Account-isolation/race testleri
 * Playwright route mock'u ile /api/chat'i deterministik hale getirir.
 */

import { test, expect, Page, BrowserContext, Route } from '@playwright/test';
import { Pool, neonConfig } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import ws from 'ws';

neonConfig.webSocketConstructor = ws as unknown as typeof globalThis.WebSocket;

const TEST_PASSWORD = 'TestPass123!';
const RUN_ID = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ADMIN_EMAIL = `admin.${RUN_ID}@e2e.findandstudy.test`;
const AGENT_EMAIL = `agent.${RUN_ID}@e2e.findandstudy.test`;

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

  // ── Deterministic RAG seed ────────────────────────────────────────────────
  // Türkçe sorguların (`başvuru`, `yönetim`) expandTurkishQueryTerms üzerinden
  // English equivalent'lere expand olduğunu kanıtlamak için bilgi tabanına
  // 'application' / 'management' içeren chunk'lar ekliyoruz. Sorgu Türkçe
  // ama eşleşme English chunk'la kuruluyor → expansion zinciri kanıtlanır.
  const sr = await pool.query(
    `INSERT INTO knowledge_sources (name, type, file_type, status, uploaded_by)
     VALUES ($1, 'file', 'excel', 'active', $2) RETURNING id`,
    [`E2E KB ${RUN_ID}`, adminId]
  );
  kbSourceId = sr.rows[0].id;
  // Embed RUN_ID as a unique marker in chunk content so retrieval provenance
  // can be asserted independently of any other rows in the KB.
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
    // Test session'larında oluşan findy konuşmalarını ve mesajlarını temizle.
    // findy_messages.conversation_id FK'si CASCADE olduğundan conversation
    // silindiğinde mesajlar otomatik silinir.
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

// ── Helpers ────────────────────────────────────────────────────────────────

type Role = 'admin' | 'agent';

interface TestUser {
  id: string;
  email: string;
  role: Role;
  name: string;
}

function userFor(role: Role): TestUser {
  return role === 'admin'
    ? { id: adminId, email: ADMIN_EMAIL, role, name: 'E2E Admin' }
    : { id: agentId, email: AGENT_EMAIL, role, name: 'E2E Agent' };
}

/**
 * Login over /api/login using the BROWSER context's request helper so the
 * httpOnly fas.sid cookie lands on the same context as page navigations
 * (otherwise the React app's auth store calls validateSession → /api/me
 * → 401 → logout() and wipes localStorage before the launcher can read it).
 * Also seed the React app's localStorage `fas_session` entry that the
 * findy-launcher reads to identify the current user.
 */
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

/**
 * Mock the /api/chat endpoint with a deterministic reply that includes the
 * given identifier in the bot message so we can assert which exchange a
 * given DOM bubble belongs to. Optional `debug` object is forwarded as-is
 * (used to verify the client-side admin gate).
 */
async function mockChatReply(
  context: BrowserContext,
  opts: {
    bodyMarker: string;
    delayMs?: number;
    debug?: unknown;
    onRequest?: (postBody: any) => void;
  }
) {
  await context.route('**/api/chat', async (route: Route) => {
    let parsed: any = {};
    try {
      parsed = JSON.parse(route.request().postData() || '{}');
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
  const input = page.locator('#findy-input');
  await input.fill(text);
  await page.locator('#findy-send').click();
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Findy chat hesap izolasyonu', () => {
  test('admin → logout → agent: bubble\'lar, sessionId VE conversationHistory sıfırlanır', async ({ browser }) => {
    const context = await browser.newContext();
    const sessionIds: string[] = [];
    // Her /api/chat çağrısında gönderilen `history` payload'ını yakalayalım —
    // agent oturumunda admin mesajları sızmamış olmalı.
    const requests: { sessionId: string; history: any[]; userId: string }[] = [];
    await context.route('**/api/chat', async (route: Route) => {
      let body: any = {};
      try { body = JSON.parse(route.request().postData() || '{}'); } catch { /* ignore */ }
      requests.push({
        sessionId: body?.sessionId,
        history: body?.history || [],
        userId: route.request().headers()['x-user-id'] || '',
      });
      sessionIds.push(body?.sessionId);
      // İlk N istek admin'e, sonrakiler agent'a — marker basit bir
      // "her istek için aynı yanıt" yaklaşımı yerine isteğe göre seçilir.
      const isAdminReq = route.request().headers()['x-user-id'] === adminId;
      const marker = isAdminReq ? 'ADMIN_REPLY_MARKER' : 'AGENT_REPLY_MARKER';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: marker,
          data: { message: marker },
        }),
      });
    });

    try {
      const page = await context.newPage();
      await loginAs(context, page, 'admin');
      await page.goto('/');
      await openChat(page);

      await sendChatMessage(page, 'admin tarafından gönderildi');
      await expect(page.locator('.findy-message.user').last()).toContainText(
        'admin tarafından gönderildi'
      );
      await expect(page.locator('.findy-message.bot').last()).toContainText(
        'ADMIN_REPLY_MARKER'
      );

      // İkinci admin mesajı → conversationHistory'de admin'in ilk turu olmalı
      await sendChatMessage(page, 'admin ikinci sorgusu');
      // Bu istekte history içinde 'admin tarafından gönderildi' geçmeli
      const adminSecondReq = requests[requests.length - 1];
      expect(
        JSON.stringify(adminSecondReq.history).toLowerCase(),
        'admin oturumunda history admin mesajını içermeli'
      ).toContain('admin tarafından gönderildi');

      // User switch
      await logout(context, page);
      await loginAs(context, page, 'agent');
      await page.goto('/');
      await openChat(page);

      // Önceki bubble'lar gitmeli
      await expect(
        page.locator('.findy-message.user', { hasText: 'admin tarafından gönderildi' })
      ).toHaveCount(0);
      await expect(
        page.locator('.findy-message.bot', { hasText: 'ADMIN_REPLY_MARKER' })
      ).toHaveCount(0);

      // Yeni mesaj — yeni sessionId üretilmiş olmalı VE history boş olmalı
      await sendChatMessage(page, 'acente sorgusu');
      await expect(page.locator('.findy-message.bot').last()).toContainText(
        'AGENT_REPLY_MARKER'
      );
      const agentReq = requests[requests.length - 1];
      expect(agentReq.userId).toBe(agentId);
      expect(agentReq.sessionId).not.toBe(adminSecondReq.sessionId);
      // KRİTİK: agent'ın ilk isteğinde history boş olmalı (admin turu sızmamış).
      expect(
        agentReq.history.length,
        `acente ilk isteğinde history dolu — admin verisi sızıyor: ${JSON.stringify(agentReq.history)}`
      ).toBe(0);
      // Çift güvence: history serialize edildiğinde admin metni geçmemeli.
      expect(JSON.stringify(agentReq.history).toLowerCase()).not.toContain(
        'admin tarafından gönderildi'
      );
      expect(sessionIds[0]).not.toBe(sessionIds[sessionIds.length - 1]);
    } finally {
      await context.close();
    }
  });

  test('cross-tab logout: storage event chat\'i resetler', async ({ browser }) => {
    const context = await browser.newContext();
    await mockChatReply(context, { bodyMarker: 'TAB1_REPLY' });

    const tab1 = await context.newPage();
    await loginAs(context, tab1, 'admin');
    await tab1.goto('/');
    await openChat(tab1);
    await sendChatMessage(tab1, 'birinci tab mesajı');
    await expect(tab1.locator('.findy-message.bot').last()).toContainText(
      'TAB1_REPLY'
    );

    // İkinci tab — agent oturumu açtığında localStorage 'storage' event'i
    // birinci tab'a yayılır ve resetChatForUserChange tetiklenir.
    const tab2 = await context.newPage();
    await loginAs(context, tab2, 'agent');
    await tab2.goto('/');

    // Geri tab1'e dönüp chat'i tekrar aç → ensureCurrentUser eski bubble'ları siler.
    await tab1.bringToFront();
    // Bir mikro tetik: aynı değeri tekrar yazmak event'i de fırlatır
    await tab1.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'fas_session' }));
    });
    // Welcome mesajı geri gelmeli — eski "birinci tab mesajı" bubble'ı yok
    await expect(
      tab1.locator('.findy-message.user', { hasText: 'birinci tab mesajı' })
    ).toHaveCount(0);

    await context.close();
  });
});

test.describe('Findy chat debug panel gating', () => {
  test('admin: server debug payload geldiğinde panel render edilir', async ({ browser }) => {
    const context = await browser.newContext();
    await mockChatReply(context, {
      bodyMarker: 'admin debug görür',
      debug: {
        queryTokens: ['başvuru'],
        expandedTerms: ['application'],
        activeFilters: { university: null, country: null, city: null },
        chunks: [
          {
            sourceId: 'fake-1',
            score: 5,
            matchedTerms: ['application'],
            preview: 'Sample chunk preview',
            metadata: { Country: 'Turkey' },
          },
        ],
      },
    });

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
    const context = await browser.newContext();
    // Acente için sunucu normalde debug GÖNDERMEZ. Testi sıkılaştırmak
    // için biz mock'tan yine de debug payload'ı dönüyoruz; client guard
    // (sess.user.role !== 'admin') paneli hiçbir koşulda render
    // etmemeli.
    await mockChatReply(context, {
      bodyMarker: 'acente yanıt',
      debug: {
        queryTokens: ['başvuru'],
        expandedTerms: ['application'],
        activeFilters: { university: null, country: null, city: null },
        chunks: [
          {
            sourceId: 'fake-1',
            score: 5,
            matchedTerms: ['application'],
            preview: 'x',
            metadata: {},
          },
        ],
      },
    });

    const page = await context.newPage();
    await loginAs(context, page, 'agent');
    await page.goto('/');
    await openChat(page);
    await sendChatMessage(page, 'başvuru nasıl yapılır');
    await expect(page.locator('.findy-message.bot').last()).toContainText(
      'acente yanıt'
    );
    await expect(page.locator('.findy-debug-panel')).toHaveCount(0);

    await context.close();
  });
});

test.describe('Findy chat race koşulu', () => {
  test('uçuşta yanıt, kullanıcı değişiminden sonra DOM\'a düşmez', async ({ browser }) => {
    const context = await browser.newContext();
    // İlk istek 1500 ms bekleyecek — bu süre içinde kullanıcı değişecek.
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

    // Mesajı gönder ama yanıt gelmeden user'ı değiştir.
    await sendChatMessage(page, 'yanıt gelmeden önce kullanıcı değişecek');
    // Yanıt henüz gelmediği için DOM'da STALE bubble bulunmamalı.
    await expect(
      page.locator('.findy-message.bot', {
        hasText: 'STALE_REPLY_FROM_PREVIOUS_USER',
      })
    ).toHaveCount(0);

    // Kullanıcıyı değiştir → resetChatForUserChange çağrılır, AbortController
    // pending fetch'i iptal eder; yanıt gelse bile chatEpoch ileri kaymıştır.
    await logout(context, page);
    await loginAs(context, page, 'agent');
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'fas_session' }));
    });

    // Bekleme süresi geçtikten sonra bile DOM'da geç gelen yanıt olmamalı.
    await page.waitForTimeout(2000);
    await expect(
      page.locator('.findy-message.bot', {
        hasText: 'STALE_REPLY_FROM_PREVIOUS_USER',
      })
    ).toHaveCount(0);

    await context.close();
  });
});

test.describe('Findy chat Türkçe RAG genişletmesi (API)', () => {
  test('admin sorgusu "başvuru" için debug.expandedTerms English equivalent içerir', async ({
    request,
  }) => {
    // /api/login → fas.sid cookie'si APIRequestContext üzerinde tutulur.
    const loginRes = await request.post('/api/login', {
      headers: { "x-playwright-test": "1" },
      data: { email: ADMIN_EMAIL, password: TEST_PASSWORD },
    });
    expect(loginRes.status()).toBe(200);

    // Query embeds the unique RUN_ID marker so only our seeded chunks can
    // top-rank for it — but ALSO contains 'başvuru' so the TR→EN expansion
    // ('basvuru' → 'application') is exercised and asserted alongside.
    const chatRes = await request.post('/api/chat', {
      headers: { 'x-user-id': adminId, 'x-playwright-test': '1' },
      data: {
        message: `başvuruyu nasıl başlatırım E2EMARKER_${RUN_ID}_APP`,
        sessionId: 'rag-test-session-' + RUN_ID,
        history: [],
      },
    });
    // KB seed'i sayesinde provider olmasa bile degraded RAG path 200 dönmeli
    // (ragContext doluyor → degraded mode'a düşüyor). 502 yalnızca provider
    // SET edilmiş ama başarısız olmuşsa olur (test ortamında provider yok).
    expect(chatRes.ok(), `admin /api/chat 2xx dönmeli, geldi: ${chatRes.status()}`).toBe(true);
    const json = await chatRes.json();
    expect(json.success).toBe(true);
    expect(json.debug, 'admin için debug payload dönmeli').toBeDefined();
    const tokens = (json.debug.queryTokens || []).join(' ').toLowerCase();
    const terms = (json.debug.expandedTerms || []).join(' ').toLowerCase();
    // Normalize edilmiş "basvuru" tokens'da görünmeli.
    expect(tokens).toContain('basvuru');
    // TR_KEYWORD_DICT['basvuru'] = ['application'] — seed chunk'ı 'application'
    // English equivalent'i ile eşleşmeli; expandedTerms VEYA chunk.matchedTerms
    // 'application' içermeli.
    const hasApplicationExpansion =
      terms.includes('application') ||
      (json.debug.chunks || []).some((c: any) =>
        (c.matchedTerms || []).some((t: string) =>
          t.toLowerCase().includes('application')
        )
      );
    expect(
      hasApplicationExpansion,
      `Türkçe expansion 'application' equivalent'ini içermeli; expandedTerms=${terms}`
    ).toBe(true);
    // Seed'imizdeki chunk en az bir kez retrieve edilmiş olmalı.
    const chunks = json.debug.chunks || [];
    expect(chunks.length, 'KB seed chunk retrieve edilmedi — RAG zinciri kırık')
      .toBeGreaterThan(0);
    // KRİTİK provenance: dönen chunk'lardan en az biri seed ettiğimiz
    // sourceId'ye ait olmalı VE içeriği RUN_ID marker'ımızı taşımalı.
    // Aksi halde test populated DB'de başka rastgele chunk'la geçebilir.
    const seedHit = chunks.find((c: any) =>
      c.sourceId === kbSourceId &&
      typeof c.preview === 'string' &&
      c.preview.includes(`E2EMARKER_${RUN_ID}_APP`)
    );
    expect(
      seedHit,
      `seed chunk (sourceId=${kbSourceId}, marker=E2EMARKER_${RUN_ID}_APP) retrieve edilmedi; geldi: ${JSON.stringify(chunks)}`
    ).toBeDefined();
  });

  test('agent sorgusu için sunucu yanıtı debug payload İÇERMEZ', async ({
    request,
  }) => {
    const loginRes = await request.post('/api/login', {
      headers: { "x-playwright-test": "1" },
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
    // Status ne olursa olsun (200 RAG-only / 200 provider / 502 fail), agent
    // yanıtında debug payload ASLA bulunmamalı — bu sunucu tarafı role
    // gating'in temel güvencesidir.
    expect(chatRes.ok(), `agent /api/chat 2xx dönmeli, geldi: ${chatRes.status()}`).toBe(true);
    const json = await chatRes.json();
    expect(json.success).toBe(true);
    expect(json.debug, 'sunucu acente için debug payload sızdırıyor').toBeUndefined();
  });
});
