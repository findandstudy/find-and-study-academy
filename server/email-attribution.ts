import type { Express, RequestHandler } from 'express';
import crypto from 'node:crypto';
import createRateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ACADEMY_ORIGIN } from './google-measurement';
import { EMAIL_ATTRIBUTION_TOKEN_MAX_LENGTH, EMAIL_ATTRIBUTION_WINDOW_DAYS, EMAIL_MESSAGE_IDS } from '@shared/email-attribution';

type Pool = { query(sql: string, values?: any[]): Promise<{ rows: any[] }> };
const windowMs = EMAIL_ATTRIBUTION_WINDOW_DAYS * 86400_000;
const payloadSchema = z.object({ v: z.literal(1), messageId: z.enum(EMAIL_MESSAGE_IDS), visitId: z.string().uuid(), createdAt: z.number().int().nonnegative() }).strict();
const visitSchema = z.object({ messageId: z.enum(EMAIL_MESSAGE_IDS), visitId: z.string().uuid(), consent: z.literal(true) }).strict();
type Payload = z.infer<typeof payloadSchema>;
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const reportSchema = z.object({ from: dateSchema.optional(), to: dateSchema.optional(), campaignId: z.string().uuid().optional() }).strict().refine(value => !value.from || !value.to || value.from <= value.to);

export async function assertEmailAttributionReady(pool: Pool): Promise<void> {
  const result = await pool.query(`SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name=ANY($1::text[])`, [['academy_email_visits', 'academy_email_registrations']]);
  const expected: Record<string, string> = {
    'academy_email_visits.id': 'uuid', 'academy_email_visits.message_id': 'text', 'academy_email_visits.created_at': 'timestamp with time zone',
    'academy_email_registrations.user_id': 'character varying', 'academy_email_registrations.message_id': 'text',
    'academy_email_registrations.visit_id': 'uuid', 'academy_email_registrations.created_at': 'timestamp with time zone',
  };
  if (!Object.entries(expected).every(([key, type]) => result.rows.some(row => `${row.table_name}.${row.column_name}` === key && row.data_type === type && row.is_nullable === 'NO'))) {
    throw new Error('Email attribution migration is not ready');
  }
  const constraints = await pool.query(`SELECT conname FROM pg_constraint WHERE conrelid IN
    (to_regclass('public.academy_email_visits'),to_regclass('public.academy_email_registrations'))`);
  const names = new Set(constraints.rows.map(row => row.conname));
  if (!['academy_email_visits_pkey', 'academy_email_visits_message_id_check', 'academy_email_registrations_pkey',
    'academy_email_registrations_user_id_fkey', 'academy_email_registrations_visit_id_fkey', 'academy_email_registrations_message_id_check'].every(name => names.has(name))) {
    throw new Error('Email attribution constraints are not ready');
  }
}

export function signEmailAttribution(payload: Payload, secret: string): string {
  if (!secret) throw new Error('Attribution signing is unavailable');
  const body = Buffer.from(JSON.stringify(payloadSchema.parse(payload))).toString('base64url');
  return `${body}.${crypto.createHmac('sha256', secret).update('academy-email-attribution:v1:' + body).digest('base64url')}`;
}

export function readEmailAttributionToken(value: unknown, secret: string, now = Date.now()): Payload | null {
  if (!secret || typeof value !== 'string' || value.length > EMAIL_ATTRIBUTION_TOKEN_MAX_LENGTH || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const [body, signature] = value.split('.');
    const expected = crypto.createHmac('sha256', secret).update('academy-email-attribution:v1:' + body).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const payload = payloadSchema.parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
    return payload.createdAt <= now + 60_000 && payload.createdAt + windowMs > now ? payload : null;
  } catch { return null; }
}

export function createEmailAttributionService(pool: Pool, options: {
  analyticsEnabled: () => Promise<boolean>; secret?: () => string; now?: () => number;
}) {
  const secret = options.secret || (() => process.env.SESSION_SECRET || '');
  const now = options.now || Date.now;
  let readyUntil = 0;
  const ready = async () => {
    if (readyUntil > now()) return;
    await assertEmailAttributionReady(pool); readyUntil = now() + 60_000;
  };
  const visit = async (input: unknown) => {
    const value = visitSchema.parse(input);
    if (!await options.analyticsEnabled()) return { status: 409, body: { success: false, code: 'ANALYTICS_DISABLED' } };
    if (!secret()) throw new Error('Attribution signing is unavailable');
    await ready();
    let result = await pool.query(`INSERT INTO academy_email_visits (id,message_id) VALUES ($1,$2)
      ON CONFLICT(id) DO NOTHING RETURNING id,message_id,created_at`, [value.visitId, value.messageId]);
    if (!result.rows.length) result = await pool.query('SELECT id,message_id,created_at FROM academy_email_visits WHERE id=$1', [value.visitId]);
    const row = result.rows[0];
    if (!row || row.message_id !== value.messageId) return { status: 409, body: { success: false, code: 'VISIT_CONFLICT' } };
    const createdAt = new Date(row.created_at).getTime();
    if (!Number.isFinite(createdAt) || createdAt + windowMs <= now()) return { status: 410, body: { success: false, code: 'VISIT_EXPIRED' } };
    const token = signEmailAttribution({ v: 1, messageId: value.messageId, visitId: value.visitId, createdAt }, secret());
    return { status: 200, body: { success: true, token, expiresAt: new Date(createdAt + windowMs).toISOString() } };
  };
  const recordRegistration = async (userId: string, token: unknown): Promise<boolean> => {
    const payload = readEmailAttributionToken(token, secret(), now());
    if (!payload) return false;
    // Optional analytics never changes an already committed registration result.
    // Bound its response delay even if the database connection becomes unavailable.
    let timeout: ReturnType<typeof setTimeout>;
    const attempt = (async () => {
      if (!await options.analyticsEnabled()) return false;
      await ready();
      const result = await pool.query(`INSERT INTO academy_email_registrations (user_id,message_id,visit_id,created_at)
        SELECT $1::varchar,v.message_id,v.id,COALESCE((SELECT m.redeemed_at FROM academy_campaign_members m WHERE m.user_id=$1::varchar),now())
        FROM academy_email_visits v WHERE v.id=$2 AND v.message_id=$3
        AND date_trunc('milliseconds',v.created_at)=$4::timestamptz AND v.created_at>now()-interval '30 days'
        ON CONFLICT(user_id) DO NOTHING RETURNING user_id`, [userId, payload.visitId, payload.messageId, new Date(payload.createdAt).toISOString()]);
      return result.rows.length === 1;
    })().catch(() => false);
    try { return await Promise.race([attempt, new Promise<boolean>(resolve => { timeout = setTimeout(() => resolve(false), 2000); })]); }
    finally { clearTimeout(timeout!); }
  };
  const report = async (input: unknown) => {
    const query = reportSchema.parse(input);
    await ready();
    const start = query.from ? query.from + 'T00:00:00.000Z' : null;
    const end = query.to ? new Date(Date.parse(query.to + 'T00:00:00.000Z') + 86400_000).toISOString() : null;
    const parameters = [start, end, query.campaignId || null];
    const [visits, conversions, first] = await Promise.all([
      pool.query(`SELECT message_id,count(*)::int AS visits FROM academy_email_visits
        WHERE ($1::timestamptz IS NULL OR created_at>=$1) AND ($2::timestamptz IS NULL OR created_at<$2) GROUP BY message_id`, parameters.slice(0, 2)),
      // Both promo partitions must share a statement snapshot: an attribution
      // committed during this report cannot be omitted or counted twice.
      pool.query(`WITH attributed AS (
        SELECT r.message_id,count(*)::int AS registrations,count(m.user_id)::int AS promo_registrations,
        count(*) FILTER(WHERE u.status IS DISTINCT FROM 'active' AND a.status='pending')::int AS pending,
        count(*) FILTER(WHERE u.status='active')::int AS approved,
        count(*) FILTER(WHERE EXISTS(SELECT 1 FROM progresses p WHERE p.user_id=r.user_id))::int AS started
        FROM academy_email_registrations r JOIN users u ON u.id=r.user_id LEFT JOIN agencies a ON a.id=u.agency_id
        LEFT JOIN academy_campaign_members m ON m.user_id=r.user_id
        WHERE ($1::timestamptz IS NULL OR r.created_at>=$1) AND ($2::timestamptz IS NULL OR r.created_at<$2)
        AND ($3::uuid IS NULL OR m.campaign_id=$3) GROUP BY r.message_id
      ), unattributed AS (
        SELECT count(*)::int AS registrations FROM academy_campaign_members m
        LEFT JOIN academy_email_registrations r ON r.user_id=m.user_id WHERE r.user_id IS NULL
        AND ($1::timestamptz IS NULL OR m.redeemed_at>=$1) AND ($2::timestamptz IS NULL OR m.redeemed_at<$2)
        AND ($3::uuid IS NULL OR m.campaign_id=$3)
      ) SELECT COALESCE((SELECT jsonb_agg(attributed) FROM attributed),'[]'::jsonb) AS attributed,
        (SELECT registrations FROM unattributed) AS unattributed_registrations`, parameters),
      pool.query('SELECT min(created_at) AS tracking_started_at FROM academy_email_visits'),
    ]);
    const registrations: any[] = conversions.rows[0]?.attributed || [];
    const rows = EMAIL_MESSAGE_IDS.map(messageId => {
      const v = visits.rows.find(row => row.message_id === messageId);
      const r = registrations.find(row => row.message_id === messageId);
      return { messageId, sequence: Number(messageId.slice(6, 8)), language: messageId.slice(-2) as 'en' | 'tr',
        visits: Number(v?.visits || 0), registrations: Number(r?.registrations || 0), promoRegistrations: Number(r?.promo_registrations || 0),
        pending: Number(r?.pending || 0), approved: Number(r?.approved || 0), started: Number(r?.started || 0) };
    });
    const totals = rows.reduce((sum, row) => ({ visits: sum.visits + row.visits, registrations: sum.registrations + row.registrations,
      promoRegistrations: sum.promoRegistrations + row.promoRegistrations, pending: sum.pending + row.pending,
      approved: sum.approved + row.approved, started: sum.started + row.started }), { visits: 0, registrations: 0, promoRegistrations: 0, pending: 0, approved: 0, started: 0 });
    return { success: true, range: { from: query.from || null, to: query.to || null, timeZone: 'UTC' }, campaignId: query.campaignId || null,
      attributionWindowDays: EMAIL_ATTRIBUTION_WINDOW_DAYS, trackingStartedAt: first.rows[0]?.tracking_started_at ? new Date(first.rows[0].tracking_started_at).toISOString() : null,
      visitsScope: 'email_series_all_campaigns', rows, totals: { ...totals, unattributedPromoRegistrations: Number(conversions.rows[0]?.unattributed_registrations || 0) } };
  };
  return { visit, recordRegistration, report, ready };
}

export type EmailAttributionService = ReturnType<typeof createEmailAttributionService>;
export type RecordEmailRegistration = EmailAttributionService['recordRegistration'];

export function registerEmailAttribution(app: Express, requireAuth: RequestHandler, requireAdmin: RequestHandler, service: EmailAttributionService) {
  const sameOrigin: RequestHandler = (req, res, next) => {
    const expected = process.env.ALLOWED_ORIGIN || (process.env.NODE_ENV === 'production' ? ACADEMY_ORIGIN : `${req.protocol}://${req.get('host')}`);
    if (req.get('origin') !== expected || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) {
      return void res.status(403).json({ success: false, code: 'SAME_ORIGIN_REQUIRED' });
    }
    next();
  };
  const limiter = createRateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false,
    message: { success: false, code: 'REQUEST_LIMIT_REACHED' } });
  app.post('/api/public/email-attribution/visit', sameOrigin, limiter, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const result = await service.visit(req.body);
      // Keep the signed receipt out of the generic JSON response logger.
      res.status(result.status).type('application/json').send(JSON.stringify(result.body));
    } catch (error) {
      res.status(error instanceof z.ZodError ? 400 : 503).json({ success: false, code: error instanceof z.ZodError ? 'INVALID_INPUT' : 'ATTRIBUTION_UNAVAILABLE' });
    }
  });
  app.get('/api/admin/email-attribution', requireAuth, requireAdmin, async (req, res) => {
    res.set('Cache-Control', 'no-store, private');
    try { res.json(await service.report(req.query)); }
    catch (error) { res.status(error instanceof z.ZodError ? 400 : 503).json({ success: false, code: error instanceof z.ZodError ? 'INVALID_RANGE' : 'ATTRIBUTION_UNAVAILABLE' }); }
  });
}
