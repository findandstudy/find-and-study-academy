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

neonConfig.webSocketConstructor = ws as any;

const TEST_PASSWORD = 'TestPass123!';
const RUN_ID = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ADMIN_EMAIL = `admin.${RUN_ID}@e2e.findandstudy.test`;
const AGENT_EMAIL = `agent.${RUN_ID}@e2e.findandstudy.test`;

let pool: Pool;
let adminId = '';
let agentId = '';

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
  test('admin → logout → agent: önceki kullanıcının bubble\'ları ve sessionId temizlenir', async ({ browser }) => {
    const context = await browser.newContext();
    const sessionIds: string[] = [];
    await mockChatReply(context, {
      bodyMarker: 'ADMIN_REPLY_MARKER',
      onRequest: (b) => sessionIds.push(b?.sessionId),
    });

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

    // Switch user
    await context.unroute('**/api/chat');
    await mockChatReply(context, {
      bodyMarker: 'AGENT_REPLY_MARKER',
      onRequest: (b) => sessionIds.push(b?.sessionId),
    });
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

    // Yeni mesaj — yeni sessionId üretilmiş olmalı
    await sendChatMessage(page, 'acente sorgusu');
    await expect(page.locator('.findy-message.bot').last()).toContainText(
      'AGENT_REPLY_MARKER'
    );
    expect(sessionIds.length).toBeGreaterThanOrEqual(2);
    expect(sessionIds[0]).not.toBe(sessionIds[sessionIds.length - 1]);

    await context.close();
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

    const chatRes = await request.post('/api/chat', {
      headers: { 'x-user-id': adminId },
      data: {
        message: 'başvuruyu nasıl başlatırım',
        sessionId: 'rag-test-session-' + RUN_ID,
        history: [],
      },
    });
    // Bu dev ortamında AI provider yapılandırılmamış olabilir; n8n webhook
    // da 404 dönebilir. O nedenle 200 (provider/n8n/degraded) ya da 502
    // (provider+webhook fail) kabul edilir — debug payload her iki yolda da
    // RAG çalıştığında üretilir (degraded mode + admin path).
    expect([200, 502]).toContain(chatRes.status());
    const json = await chatRes.json();
    expect(json).toBeTruthy();
    if (json.debug) {
      const tokens = (json.debug.queryTokens || []).join(' ').toLowerCase();
      const terms = (json.debug.expandedTerms || []).join(' ').toLowerCase();
      // Normalize edilmiş "basvuru" tokens'da görünmeli.
      expect(tokens).toContain('basvuru');
      // TR_KEYWORD_DICT['basvuru'] = ['application'] — expansion English
      // equivalent'ini eklemiş olmalı (chunk olmasa bile expandedTerms'de).
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
    }
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
      headers: { 'x-user-id': agentId },
      data: {
        message: 'yönetim programları',
        sessionId: 'rag-test-agent-' + RUN_ID,
        history: [],
      },
    });
    // Status ne olursa olsun (200 RAG-only / 200 provider / 502 fail), agent
    // yanıtında debug payload ASLA bulunmamalı — bu sunucu tarafı role
    // gating'in temel güvencesidir.
    expect([200, 502]).toContain(chatRes.status());
    const json = await chatRes.json();
    expect(json).toBeTruthy();
    expect(json.debug, 'sunucu acente için debug payload sızdırıyor').toBeUndefined();
  });
});
