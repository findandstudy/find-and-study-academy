import type { Express, RequestHandler } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';

export const ACADEMY_ORIGIN = 'https://academy.findandstudy.com';
export const GOOGLE_INTEGRATION_NAMES = ['google_analytics', 'google_search_console'] as const;
export const isGoogleMeasurementIntegration = (name: unknown) =>
  typeof name === 'string' && GOOGLE_INTEGRATION_NAMES.includes(name as typeof GOOGLE_INTEGRATION_NAMES[number]);

const measurementId = z.string().trim().toUpperCase().max(22).refine(value => !value || /^G-[A-Z0-9]{4,20}$/.test(value), 'Invalid GA4 measurement ID');
const propertyId = z.string().trim().max(30).regex(/^\d*$/, 'Analytics property ID must contain digits').optional().default('');
const searchProperty = z.enum(['', 'sc-domain:academy.findandstudy.com', `${ACADEMY_ORIGIN}/`]);
const token = z.string().trim().max(512).refine(value => !value || /^[A-Za-z0-9_-]{8,512}$/.test(value), 'Invalid Search Console verification token').optional().default('');

export const googleMeasurementSchema = z.object({
  analytics: z.object({ enabled: z.boolean(), measurementId, propertyId }).strict(),
  searchConsole: z.object({
    enabled: z.boolean(), property: searchProperty,
    verificationMethod: z.enum(['dns', 'html']), verificationToken: token,
  }).strict(),
}).strict().superRefine((config, context) => {
  if (config.analytics.enabled && !config.analytics.measurementId) {
    context.addIssue({ code: 'custom', path: ['analytics', 'measurementId'], message: 'A GA4 measurement ID is required when enabled' });
  }
  if (config.searchConsole.enabled && !config.searchConsole.property) {
    context.addIssue({ code: 'custom', path: ['searchConsole', 'property'], message: 'A Search Console property is required when enabled' });
  }
  if (config.searchConsole.enabled && config.searchConsole.verificationMethod === 'html') {
    if (config.searchConsole.property !== `${ACADEMY_ORIGIN}/`) {
      context.addIssue({ code: 'custom', path: ['searchConsole', 'property'], message: 'HTML verification requires the Academy URL-prefix property' });
    }
    if (!config.searchConsole.verificationToken) {
      context.addIssue({ code: 'custom', path: ['searchConsole', 'verificationToken'], message: 'An HTML verification token is required' });
    }
  }
}).transform(config => {
  if (!config.searchConsole.enabled && !config.searchConsole.property) {
    config.searchConsole.property = 'sc-domain:academy.findandstudy.com';
  }
  return config;
});

export type GoogleMeasurementConfig = z.infer<typeof googleMeasurementSchema>;
type IntegrationRow = { id?: string; name: string; enabled: boolean; settings: string | null };
type Queryable = { query(sql: string, values?: any[]): Promise<{ rows: any[] }> };
export type GoogleMeasurementPool = Queryable & { connect(): Promise<Queryable & { release(): void }> };

export function defaultGoogleMeasurementConfig(): GoogleMeasurementConfig {
  return {
    analytics: { enabled: false, measurementId: '', propertyId: '' },
    searchConsole: { enabled: false, property: 'sc-domain:academy.findandstudy.com', verificationMethod: 'dns', verificationToken: '' },
  };
}

// Only named, typed public configuration is read. Existing integration secrets
// never enter this service, its public response, or the HTML renderer.
export function configFromIntegrationRows(rows: IntegrationRow[]): GoogleMeasurementConfig {
  const config = defaultGoogleMeasurementConfig();
  for (const [name, key] of [['google_analytics', 'analytics'], ['google_search_console', 'searchConsole']] as const) {
    const matches = rows.filter(row => row.name === name);
    // Ambiguous or corrupt records fail closed until an administrator saves them.
    if (matches.length !== 1) continue;
    try {
      const row = matches[0];
      const settings = JSON.parse(row.settings || '{}');
      const candidate = { ...defaultGoogleMeasurementConfig(), [key]: { ...settings, enabled: row.enabled } };
      const parsed = googleMeasurementSchema.safeParse(candidate);
      if (parsed.success) Object.assign(config[key], parsed.data[key]);
    } catch {
      // Invalid stored JSON cannot enable a Google tag or add markup.
    }
  }
  return config;
}

export function publicMeasurementConfig(config: GoogleMeasurementConfig) {
  return {
    success: true as const,
    analyticsEnabled: config.analytics.enabled,
    measurementId: config.analytics.enabled ? config.analytics.measurementId : null,
    consentRequired: true as const,
  };
}

export function adminMeasurementConfig(config: GoogleMeasurementConfig) {
  return {
    success: true as const,
    analytics: { ...config.analytics },
    searchConsole: { ...config.searchConsole },
    status: {
      analytics: config.analytics.enabled ? 'configured' : 'disabled',
      searchConsole: !config.searchConsole.enabled ? 'disabled' : config.searchConsole.verificationMethod === 'dns'
        ? 'dns_verification_managed_in_google' : 'html_tag_configured',
    },
  };
}

export function createGoogleMeasurementService(pool: GoogleMeasurementPool) {
  const read = async () => {
    const result = await pool.query(
      'SELECT name, enabled, settings FROM integrations WHERE name = ANY($1::text[])',
      [[...GOOGLE_INTEGRATION_NAMES]],
    );
    return configFromIntegrationRows(result.rows);
  };
  const save = async (input: unknown, userId: string): Promise<GoogleMeasurementConfig> => {
    const config = googleMeasurementSchema.parse(input);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Names have no unique constraint in the existing table. Serialize our
      // two-provider upsert without requiring a production schema migration.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['academy.google-measurement']);
      const existing = await client.query(
        'SELECT id, name FROM integrations WHERE name = ANY($1::text[]) ORDER BY created_at, id FOR UPDATE',
        [[...GOOGLE_INTEGRATION_NAMES]],
      );
      for (const [name, key, displayName] of [
        ['google_analytics', 'analytics', 'Google Analytics 4'],
        ['google_search_console', 'searchConsole', 'Google Search Console'],
      ] as const) {
        const matches = existing.rows.filter(row => row.name === name);
        const id = matches[0]?.id || crypto.randomUUID();
        // Preserve historical duplicate rows and their event associations, but
        // retire their reserved name and disable them so they cannot add tags.
        for (const duplicate of matches.slice(1)) {
          await client.query('UPDATE integrations SET name=$2, enabled=false, updated_at=now(), updated_by=$3 WHERE id=$1',
            [duplicate.id, `archived_${name}_${duplicate.id}`, userId]);
        }
        const values = [id, name, displayName, config[key].enabled, JSON.stringify(config[key]), userId];
        if (matches.length) {
          await client.query(`UPDATE integrations SET name=$2, type='analytics', display_name=$3, enabled=$4,
            settings=$5, updated_by=$6, updated_at=now(), last_test_status='not_tested',
            last_test_message='Configuration saved; Google collection and ownership have not been checked' WHERE id=$1`, values);
        } else {
          await client.query(`INSERT INTO integrations (id,name,type,display_name,enabled,settings,created_by,updated_by,last_test_status,last_test_message)
            VALUES ($1,$2,'analytics',$3,$4,$5,$6,$6,'not_tested','Configuration saved; Google collection and ownership have not been checked')`, values);
        }
      }
      await client.query('COMMIT');
      return config;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  return { read, save };
}

export type GoogleMeasurementService = ReturnType<typeof createGoogleMeasurementService>;

export function registerGoogleMeasurement(
  app: Express, requireAuth: RequestHandler, requireAdmin: RequestHandler, service: GoogleMeasurementService,
) {
  app.get('/api/public/measurement-config', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      res.json(publicMeasurementConfig(await service.read()));
    } catch {
      // A configuration outage must not start tracking or break public pages.
      res.json(publicMeasurementConfig(defaultGoogleMeasurementConfig()));
    }
  });
  app.get('/api/admin/google-measurement', requireAuth, requireAdmin, async (_req, res) => {
    res.set('Cache-Control', 'no-store, private');
    try { res.json(adminMeasurementConfig(await service.read())); }
    catch { res.status(503).json({ success: false, message: 'Google measurement configuration is unavailable' }); }
  });
  app.put('/api/admin/google-measurement', requireAuth, requireAdmin, async (req, res) => {
    res.set('Cache-Control', 'no-store, private');
    const parsed = googleMeasurementSchema.safeParse(req.body);
    if (!parsed.success) {
      return void res.status(400).json({ success: false, message: 'Invalid Google measurement configuration',
        issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })) });
    }
    try {
      res.json(adminMeasurementConfig(await service.save(parsed.data, (req as any).user.id)));
    } catch { res.status(503).json({ success: false, message: 'Google measurement configuration could not be saved' }); }
  });
}

export function escapeHtmlAttribute(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

// Only the public homepage belongs in search. Token-bearing and authenticated
// routes get noindex even when the SPA falls back to a 200 HTML response.
export function isIndexableAcademyRequest(url: string) {
  const pathname = url.split(/[?#]/, 1)[0];
  return pathname === '/' && !url.includes('?') && !url.includes('#');
}

export function renderGoogleMeasurementHead(html: string, url: string, config: GoogleMeasurementConfig) {
  const indexable = isIndexableAcademyRequest(url);
  const metadata = [indexable
    ? `<link rel="canonical" href="${ACADEMY_ORIGIN}/" />`
    : '<meta name="robots" content="noindex, nofollow" />'];
  const search = config.searchConsole;
  if (indexable && search.enabled && search.verificationMethod === 'html' && search.verificationToken) {
    metadata.push(`<meta name="google-site-verification" content="${escapeHtmlAttribute(search.verificationToken)}" />`);
  }
  return html.replace(/<\/head\s*>/i, `${metadata.join('\n')}\n</head>`);
}

export const academyRobots = `User-agent: *\nAllow: /$\nAllow: /assets/\nAllow: /favicon.ico\nAllow: /api/public/countries$\nDisallow: /admin\nDisallow: /agent\nDisallow: /api\nDisallow: /uploads\nDisallow: /embed\nDisallow: /login\nDisallow: /signup\nDisallow: /forgot-password\nDisallow: /reset-password\nDisallow: /verify\nDisallow: /*?\nSitemap: ${ACADEMY_ORIGIN}/sitemap.xml\n`;
export const academySitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${ACADEMY_ORIGIN}/</loc></url></urlset>\n`;

export function registerAcademyCrawling(app: Express) {
  app.use((req, res, next) => {
    if (!isIndexableAcademyRequest(req.originalUrl) && !['/robots.txt', '/sitemap.xml'].includes(req.path)) {
      res.set('X-Robots-Tag', 'noindex, nofollow');
    }
    next();
  });
  app.get('/robots.txt', (_req, res) => res.type('text/plain').send(academyRobots));
  app.get('/sitemap.xml', (_req, res) => res.type('application/xml').send(academySitemap));
}
