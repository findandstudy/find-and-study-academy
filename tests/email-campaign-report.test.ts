import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANGUAGE_CODES } from '../shared/languages';
import { emailCampaignReportRows, emailCampaignReportView, readEmailCampaignReport } from '../client/src/components/EmailCampaignReport';
import {
  EMAIL_ATTRIBUTION_COPY_KEYS, EMAIL_ATTRIBUTION_COPY_ROWS, EMAIL_ATTRIBUTION_MESSAGE_KEYS, getEmailAttributionCopy,
} from '../client/src/lib/email-attribution-copy';

type Report = ReturnType<typeof readEmailCampaignReport>;
const zeroCounts = () => ({ visits: 0, registrations: 0, promoRegistrations: 0, pending: 0, approved: 0 });
function emptyReport(): Report {
  return {
    success: true, range: { from: null, to: null, timeZone: 'UTC' }, campaignId: null,
    attributionWindowDays: 30, trackingStartedAt: null, visitsScope: 'email_series_all_campaigns',
    rows: Array.from({ length: 10 }, (_, index) => {
      const sequence = index % 5 + 1;
      const language = index < 5 ? 'en' as const : 'tr' as const;
      return { messageId: `email_${String(sequence).padStart(2, '0')}_${language}`, sequence, language, ...zeroCounts() };
    }),
    totals: { ...zeroCounts(), unattributedPromoRegistrations: 0 },
  };
}

test('five combined emails add EN/TR counts once without changing the ten source messages', () => {
  const report = emptyReport();
  Object.assign(report.rows[0], { visits: 6, registrations: 2, promoRegistrations: 1, pending: 1, approved: 1 });
  Object.assign(report.rows[5], { visits: 9, registrations: 3, promoRegistrations: 2, pending: 1, approved: 2 });
  Object.assign(report.rows[3], { visits: 8, registrations: 1, promoRegistrations: 1, pending: 1, approved: 0 });
  report.totals = { visits: 23, registrations: 6, promoRegistrations: 4, pending: 3, approved: 3, unattributedPromoRegistrations: 0 };
  const original = structuredClone(report.rows);
  const combined = emailCampaignReportRows(report.rows, 'combined');
  assert.equal(combined.length, 5);
  assert.equal(new Set(combined.map(row => row.sequence)).size, 5);
  assert.deepEqual(combined.find(row => row.sequence === 1), {
    messageId: 'email_01', sequence: 1, language: 'en', visits: 15,
    registrations: 5, promoRegistrations: 3, pending: 2, approved: 3,
  });
  assert.deepEqual(emailCampaignReportView(report, 'combined').totals, {
    visits: 23, registrations: 6, promoRegistrations: 4, pending: 3, approved: 3,
  });
  assert.equal(emailCampaignReportRows(report.rows, 'all').length, 10);
  assert.deepEqual(report.rows, original);
});

test('registration ranking is independent of visits, promo count and source order', () => {
  const report = emptyReport();
  Object.assign(report.rows[0], { visits: 200, registrations: 2, promoRegistrations: 2 });
  Object.assign(report.rows[1], { visits: 3, registrations: 4, promoRegistrations: 0 });
  Object.assign(report.rows[5], { visits: 1, registrations: 3, promoRegistrations: 1 });
  report.totals = { visits: 204, registrations: 9, promoRegistrations: 3, pending: 0, approved: 0, unattributedPromoRegistrations: 0 };
  const all = emailCampaignReportRows(report.rows, 'all');
  assert.deepEqual(all.slice(0, 3).map(row => row.messageId), ['email_02_en', 'email_01_tr', 'email_01_en']);
  assert.deepEqual(emailCampaignReportRows(report.rows, 'tr').map(row => row.language), ['tr', 'tr', 'tr', 'tr', 'tr']);
  assert.equal(emailCampaignReportRows(report.rows, 'combined')[0].messageId, 'email_01');
});

test('seven attributed promo registrations plus three unknown sources remain ten in every language view', () => {
  const report = emptyReport();
  Object.assign(report.rows[0], { visits: 12, registrations: 7, promoRegistrations: 7, pending: 3, approved: 4 });
  report.totals = { visits: 12, registrations: 7, promoRegistrations: 7, pending: 3, approved: 4, unattributedPromoRegistrations: 3 };
  const parsed = readEmailCampaignReport(report);
  for (const view of ['all', 'combined', 'en', 'tr'] as const) {
    const result = emailCampaignReportView(parsed, view);
    assert.equal(result.allPromoRegistrations, 10, view);
    assert.equal(result.totals.promoRegistrations, view === 'tr' ? 0 : 7, view);
  }
  assert.equal(parsed.totals.unattributedPromoRegistrations, 3);
});

test('an empty report keeps all ten message rows instead of inventing past attribution', () => {
  const report = readEmailCampaignReport(emptyReport());
  assert.equal(emailCampaignReportView(report, 'all').rows.length, 10);
  assert.equal(emailCampaignReportView(report, 'combined').rows.length, 5);
  assert.equal(report.trackingStartedAt, null);
  assert.equal(emailCampaignReportView(report, 'all').allPromoRegistrations, 0);
});

test('malformed responses cannot display plausible but incorrect report totals', () => {
  const malformed: unknown[] = [null, {}, { ...emptyReport(), success: false }, { ...emptyReport(), attributionWindowDays: 7 },
    { ...emptyReport(), visitsScope: 'selected_campaign' }, { ...emptyReport(), trackingStartedAt: 'not-a-date' },
    { ...emptyReport(), range: { timeZone: 'Europe/Istanbul' } }];
  const mutate = (fn: (report: Report) => void) => { const report = emptyReport(); fn(report); malformed.push(report); };
  mutate(report => { report.rows.pop(); });
  mutate(report => { report.rows[1] = { ...report.rows[0] }; });
  mutate(report => { report.rows[0].messageId = 'email_99_en'; });
  mutate(report => { report.rows[0].visits = -1; });
  mutate(report => { report.rows[0].registrations = 0.5; });
  mutate(report => { report.totals.promoRegistrations = 7; });
  mutate(report => { report.totals.unattributedPromoRegistrations = -1; });
  for (const value of malformed) assert.throws(() => readEmailCampaignReport(value));
});

test('all email report labels resolve in the 23 supported languages', () => {
  assert.equal(LANGUAGE_CODES.length, 23);
  assert.deepEqual(Object.keys(EMAIL_ATTRIBUTION_COPY_ROWS).sort(), [...LANGUAGE_CODES].sort());
  for (const language of LANGUAGE_CODES) {
    assert.equal(EMAIL_ATTRIBUTION_COPY_ROWS[language].length, EMAIL_ATTRIBUTION_MESSAGE_KEYS.length, language);
    const copy = getEmailAttributionCopy(language + '-XX');
    assert.deepEqual(Object.keys(copy).sort(), [...EMAIL_ATTRIBUTION_COPY_KEYS].sort());
    assert(Object.values(copy).every(value => typeof value === 'string' && value.trim().length > 0), language);
  }
});
