/** Local UI verification only. Synthetic fixtures, no DB, no credentials, no external writes.
 * Build first, then: node --import tsx scripts/agent-ux-preview.ts
 */
import express from 'express';
import path from 'node:path';
import { resolveTrainingCourse } from '../shared/training-course';
import { agentAgencyUpdateSchema } from '../shared/agency-update';

if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) throw new Error('Preview requires an isolated environment without a database.');
const app = express();
app.use(express.json());
const user = { id: 'synthetic-agent', name: 'UX Test Agent', email: 'agent@example.invalid', role: 'agent', agencyId: 'synthetic-agency', status: 'active', languagePreference: 'en' };
let agency = { id: user.agencyId, name: 'Synthetic Test Agency', country: 'TR', city: '', status: 'active', phone: '+905551234567', primaryContactName: user.name, primaryContactEmail: user.email };
const countries = [
  { id: 'tr', code: 'TR', name: 'Türkiye' }, { id: 'lv', code: 'LV', name: 'Latvia' },
  ...['DE', 'GB', 'US', 'CA', 'AU', 'NZ', 'FR', 'IT', 'ES', 'PL', 'HU', 'NL', 'IE', 'MT', 'LT'].map(code => ({ id: code.toLowerCase(), code, name: new Intl.DisplayNames(['en'], { type: 'region' }).of(code)! })),
].map(country => ({ ...country, status: 'active' }));
const contents = countries.flatMap(country => Array.from({ length: country.id === 'lv' ? 3 : 1 }, (_, index) => ({
  id: `${country.id}-${index + 1}`, countryId: country.id, title: `${country.name} — lesson ${index + 1}`,
  section: 'A1 Destination Countries', status: 'published', sortOrder: index,
  content: `<h2>${country.name} — lesson ${index + 1}</h2><p>Synthetic training material. No production data.</p>`,
})));
const progress = { id: 'synthetic-progress', userId: user.id, courseId: 'course-lv', percent: 33, lessonCompletedIds: ['lv-1'], updatedAt: new Date().toISOString() };
const quizzes = [{ id: 'synthetic-final', title: 'Latvia Final Exam', isFinal: true, countryId: 'lv', courseId: 'course-lv', passPercent: 80, questions: [] }];
const certificate = { id: 'synthetic-certificate', userId: user.id, courseId: 'course-lv', scorePercent: 90, code: 'SYNTHETIC-ONLY', issuedAt: new Date().toISOString(), course: resolveTrainingCourse('course-lv', [], countries), user: { id: user.id, name: user.name }, agency };
app.use('/api', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const url = req.path;
  if (req.method === 'PUT' && url === '/agency') {
    const parsed = agentAgencyUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid self-service update' });
    agency = { ...agency, ...parsed.data } as typeof agency;
    return res.json({ success: true, agency });
  }
  if (req.method === 'PATCH' && url === '/me/language') {
    user.languagePreference = String(req.body.languagePreference);
    return res.json({ success: true });
  }
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Preview does not execute production actions' });
  const responses: Record<string, unknown> = {
    '/me': { success: true, user }, '/me/completion': { required: false },
    '/agency': { success: true, agency }, '/courses': { success: true, courses: [] },
    '/public/countries': { success: true, countries }, '/public/contents': { success: true, contents },
    '/public/quizzes': { success: true, quizzes }, '/attempts': { success: true, attempts: [] },
    '/progress': { success: true, progresses: [progress] }, '/progress/course-lv': { success: true, progress },
    '/certificates': { success: true, certificates: [certificate] },
    '/verify': { success: true, certificate }, '/announcements': { success: true, announcements: [] },
    '/analytics/my-activity': { success: true, activity: [] }, '/popups/active': { success: true, popups: [] },
    '/settings/defaults': { success: true, defaults: { default_country_code: 'TR' } },
    '/menu-visibility': { dashboard: true, findy: true }, '/sidebar-links': { success: true, links: [] },
    '/brand/logo': { logo: null }, '/public/measurement-config': { enabled: false },
  };
  if (url in responses) return res.json(responses[url]);
  if (url.startsWith('/progress/')) return res.json({ success: true, progress: { lessonCompletedIds: [], percent: 0 } });
  return res.status(404).json({ success: false, message: 'No synthetic fixture for this endpoint' });
});
const publicDir = path.resolve('dist/public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.listen(5179, '127.0.0.1', () => console.log('Synthetic Academy UX preview: http://127.0.0.1:5179/agent/dashboard'));
