import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiRequest } from '@/lib/queryClient';
import { useEmailAttributionCopy } from '@/lib/email-attribution-copy';

const REPORT_URL = '/api/admin/email-attribution';
type View = 'all' | 'combined' | 'en' | 'tr';
type Counts = { visits: number; registrations: number; promoRegistrations: number; pending: number; approved: number };
type MessageRow = Counts & { messageId: string; sequence: number; language: 'en' | 'tr' };
type Report = {
  success: true;
  range: { from: string | null; to: string | null; timeZone: 'UTC' };
  campaignId: string | null;
  attributionWindowDays: 30;
  trackingStartedAt: string | null;
  visitsScope: 'email_series_all_campaigns';
  rows: MessageRow[];
  totals: Counts & { unattributedPromoRegistrations: number };
};

const METRICS = ['visits', 'registrations', 'promoRegistrations', 'pending', 'approved'] as const;

export function emailCampaignReportRows(rows: MessageRow[], view: View): MessageRow[] {
  const selected = view === 'en' || view === 'tr' ? rows.filter(row => row.language === view) : rows;
  const result = view === 'combined' ? Array.from({ length: 5 }, (_, index) => {
    const matches = selected.filter(row => row.sequence === index + 1);
    return {
      messageId: `email_${String(index + 1).padStart(2, '0')}`,
      sequence: index + 1,
      language: 'en' as const,
      ...Object.fromEntries(METRICS.map(metric => [metric, matches.reduce((sum, row) => sum + row[metric], 0)])) as Counts,
    };
  }) : [...selected];
  return result.sort((a, b) => b.registrations - a.registrations || a.sequence - b.sequence || a.language.localeCompare(b.language));
}

export function emailCampaignReportView(report: Report, view: View) {
  const rows = emailCampaignReportRows(report.rows, view);
  const totals = Object.fromEntries(METRICS.map(metric => [metric, rows.reduce((sum, row) => sum + row[metric], 0)])) as Counts;
  return { rows, totals, allPromoRegistrations: report.totals.promoRegistrations + report.totals.unattributedPromoRegistrations };
}

export function readEmailCampaignReport(value: unknown): Report {
  const report = value as Report | null;
  const validCounts = (counts: Counts) => counts && METRICS.every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0);
  if (!report || report.success !== true || report.attributionWindowDays !== 30 || report.visitsScope !== 'email_series_all_campaigns' ||
    (report.trackingStartedAt !== null && (typeof report.trackingStartedAt !== 'string' || !Number.isFinite(Date.parse(report.trackingStartedAt)))) ||
    report.range?.timeZone !== 'UTC' || !Array.isArray(report.rows) || report.rows.length !== 10 ||
    !validCounts(report.totals) || !Number.isSafeInteger(report.totals.unattributedPromoRegistrations) || report.totals.unattributedPromoRegistrations < 0 ||
    new Set(report.rows.map(row => row.messageId)).size !== 10 ||
    !report.rows.every(row => validCounts(row) && ['en', 'tr'].includes(row.language) &&
      Number.isInteger(row.sequence) && row.sequence >= 1 && row.sequence <= 5 &&
      row.messageId === `email_${String(row.sequence).padStart(2, '0')}_${row.language}`) ||
    !METRICS.every(metric => report.totals[metric] === report.rows.reduce((sum, row) => sum + row[metric], 0))) {
    throw new Error('Invalid email campaign report');
  }
  return report;
}

export function EmailCampaignReport({ campaigns = [] }: { campaigns?: { id: string; label: string }[] }) {
  const { copy, locale } = useEmailAttributionCopy();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [campaignId, setCampaignId] = useState('all');
  const [view, setView] = useState<View>('all');
  const invalidDates = !!from && !!to && from > to;
  const query = useQuery({
    queryKey: [REPORT_URL, from, to, campaignId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (campaignId !== 'all') params.set('campaignId', campaignId);
      const response = await apiRequest('GET', `${REPORT_URL}${params.size ? `?${params}` : ''}`);
      return readEmailCampaignReport(await response.json());
    },
    enabled: !invalidDates,
    staleTime: 30000,
  });
  const viewModel = query.data ? emailCampaignReportView(query.data, view) : null;
  const rows = viewModel?.rows || [];
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const noData = query.data && rows.every(row => METRICS.every(metric => row[metric] === 0)) && query.data.totals.unattributedPromoRegistrations === 0;

  return (
    <Card data-testid="email-campaign-report">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{copy.title}</CardTitle>
          <Button type="button" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching || invalidDates} data-testid="refresh-email-report">
            <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />{copy.refresh}
          </Button>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="email-report-from">{copy.from} (UTC)</Label>
            <Input id="email-report-from" type="date" value={from} onChange={event => setFrom(event.target.value)} max={to || undefined} aria-describedby="email-report-dates-note" />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="email-report-to">{copy.to} (UTC)</Label>
            <Input id="email-report-to" type="date" value={to} onChange={event => setTo(event.target.value)} min={from || undefined} aria-describedby="email-report-dates-note" />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="email-report-campaign">{copy.campaign}</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger id="email-report-campaign" className="text-start"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.allCampaigns}</SelectItem>
                {campaigns.map(campaign => <SelectItem key={campaign.id} value={campaign.id}>{campaign.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="email-report-view">{copy.view}</Label>
            <Select value={view} onValueChange={(value: View) => setView(value)}>
              <SelectTrigger id="email-report-view" className="text-start"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.allMessages}</SelectItem>
                <SelectItem value="combined">{copy.combined}</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="tr">Türkçe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p id="email-report-dates-note" className="text-xs text-muted-foreground">{copy.dateNote}</p>
      </CardHeader>
      <CardContent className="space-y-4" aria-busy={query.isFetching}>
        <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          <p>{copy.visitsNote}</p>
          <p>{copy.attributionNote} {copy.historyNote}</p>
        </div>
        {invalidDates ? <p role="alert" className="text-sm text-destructive">{copy.invalidDates}</p> : query.isError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm text-destructive">{copy.loadError}</p>
            <Button type="button" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>{copy.retry}</Button>
          </div>
        ) : query.isLoading || !query.data || !viewModel ? <p role="status" className="text-sm text-muted-foreground">{copy.loading}</p> : (
          <>
            {noData && <p role="status" className="text-sm text-muted-foreground">{copy.noData}</p>}
            <div role="region" aria-label={copy.title} tabIndex={0} className="overflow-x-auto rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Table className="min-w-[650px]" data-testid="email-report-table">
                <TableCaption>{copy.ranked}</TableCaption>
                <TableHeader><TableRow>
                  <TableHead scope="col" className="text-start">{copy.email}</TableHead>
                  {METRICS.map(metric => <TableHead scope="col" key={metric} className="text-end" aria-sort={metric === 'registrations' ? 'descending' : undefined}>{copy[metric]}</TableHead>)}
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map(row => <TableRow key={row.messageId} data-testid={`email-report-row-${row.messageId}`}>
                    <TableCell className="text-start font-medium"><span>{copy.email} {number(row.sequence)}{view !== 'combined' ? ` · ${row.language.toUpperCase()}` : ''}</span><div className="text-xs font-normal text-muted-foreground" dir="ltr">{row.messageId}</div></TableCell>
                    {METRICS.map(metric => <TableCell key={metric} className="text-end tabular-nums">{number(row[metric])}</TableCell>)}
                  </TableRow>)}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>{copy.totals}</TableCell>
                    {METRICS.map(metric => <TableCell key={metric} className="text-end tabular-nums">{number(viewModel.totals[metric])}</TableCell>)}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="rounded-md border p-4" data-testid="email-report-unattributed">
              <p className="text-sm font-medium">{copy.unknownTitle}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{number(query.data.totals.unattributedPromoRegistrations)}</p>
              <p className="mt-2 text-sm text-muted-foreground">{copy.unknownNote}</p>
              <p className="mt-3 text-sm font-medium">{copy.allPromoRegistrations}: {number(viewModel.allPromoRegistrations)}</p>
            </div>
            {query.data.trackingStartedAt && Number.isFinite(Date.parse(query.data.trackingStartedAt)) && <p className="text-xs text-muted-foreground">
              {copy.firstVisit}: {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(query.data.trackingStartedAt))} (UTC)
            </p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
