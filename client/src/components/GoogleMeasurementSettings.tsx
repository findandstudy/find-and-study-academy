import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, ExternalLink, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useGoogleMeasurementCopy } from '@/lib/google-measurement-copy';
import { useToast } from '@/hooks/use-toast';

const SETTINGS_URL = '/api/admin/google-measurement';
const DOMAIN_PROPERTY = 'sc-domain:academy.findandstudy.com';
const URL_PROPERTY = 'https://academy.findandstudy.com/';

interface GoogleMeasurementConfig {
  analytics: {
    enabled: boolean;
    measurementId: string;
    propertyId?: string;
  };
  searchConsole: {
    enabled: boolean;
    property: string;
    verificationMethod: 'dns' | 'html';
    verificationToken?: string;
  };
}

interface GoogleMeasurementResponse extends GoogleMeasurementConfig {
  success: true;
}

function readConfiguration(value: unknown): GoogleMeasurementResponse {
  const config = value as GoogleMeasurementResponse | null;
  if (
    !config || config.success !== true ||
    typeof config.analytics?.enabled !== 'boolean' ||
    typeof config.analytics?.measurementId !== 'string' ||
    (config.analytics.propertyId !== undefined && typeof config.analytics.propertyId !== 'string') ||
    typeof config.searchConsole?.enabled !== 'boolean' ||
    ![DOMAIN_PROPERTY, URL_PROPERTY].includes(config.searchConsole.property) ||
    !['dns', 'html'].includes(config.searchConsole.verificationMethod) ||
    (config.searchConsole.verificationToken !== undefined && typeof config.searchConsole.verificationToken !== 'string')
  ) {
    throw new Error('Invalid measurement configuration');
  }
  return config;
}

export function GoogleMeasurementSettings() {
  const copy = useGoogleMeasurementCopy();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<GoogleMeasurementConfig | null>(null);
  const [invalidSettings, setInvalidSettings] = useState(false);
  const configuration = useQuery({
    queryKey: [SETTINGS_URL],
    queryFn: async () => {
      const response = await apiRequest('GET', SETTINGS_URL);
      return readConfiguration(await response.json());
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (configuration.data && !draft) {
      setDraft({ analytics: { ...configuration.data.analytics }, searchConsole: { ...configuration.data.searchConsole } });
    }
  }, [configuration.data, draft]);

  const save = useMutation({
    mutationFn: async (settings: GoogleMeasurementConfig) => {
      const response = await apiRequest('PUT', SETTINGS_URL, settings);
      return readConfiguration(await response.json());
    },
    onSuccess: (settings) => {
      queryClient.setQueryData([SETTINGS_URL], settings);
      queryClient.invalidateQueries({ queryKey: ['/api/public/measurement-config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/integrations'] });
      setDraft({ analytics: { ...settings.analytics }, searchConsole: { ...settings.searchConsole } });
      toast({ title: copy.saved });
    },
  });

  const updateDraft = (settings: GoogleMeasurementConfig) => {
    setInvalidSettings(false);
    save.reset();
    setDraft(settings);
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || save.isPending) return;
    const settings: GoogleMeasurementConfig = {
      analytics: {
        enabled: draft.analytics.enabled,
        measurementId: draft.analytics.measurementId.trim().toUpperCase(),
        propertyId: draft.analytics.propertyId?.trim() || '',
      },
      searchConsole: {
        enabled: draft.searchConsole.enabled,
        property: draft.searchConsole.property,
        verificationMethod: draft.searchConsole.verificationMethod,
        verificationToken: draft.searchConsole.verificationMethod === 'html'
          ? draft.searchConsole.verificationToken?.trim() || '' : '',
      },
    };
    const { analytics, searchConsole } = settings;
    if (
      (analytics.measurementId && !/^G-[A-Z0-9]{4,20}$/.test(analytics.measurementId)) ||
      (analytics.enabled && !analytics.measurementId) ||
      (analytics.propertyId && !/^\d{1,30}$/.test(analytics.propertyId)) ||
      ![DOMAIN_PROPERTY, URL_PROPERTY].includes(searchConsole.property) ||
      (searchConsole.verificationMethod === 'html' && (
        searchConsole.property !== URL_PROPERTY ||
        (searchConsole.verificationToken && !/^[A-Za-z0-9_-]{8,512}$/.test(searchConsole.verificationToken)) ||
        (searchConsole.enabled && !searchConsole.verificationToken)
      ))
    ) {
      setInvalidSettings(true);
      return;
    }
    save.mutate(settings);
  };

  const persisted = configuration.data;
  const analyticsUrl = persisted?.analytics.propertyId && /^\d{1,30}$/.test(persisted.analytics.propertyId)
    ? `https://analytics.google.com/analytics/web/#/p${persisted.analytics.propertyId}/reports/intelligenthome`
    : 'https://analytics.google.com/';
  const searchConsoleUrl = persisted
    ? `https://search.google.com/search-console?resource_id=${encodeURIComponent(persisted.searchConsole.property)}`
    : 'https://search.google.com/search-console';

  return (
    <Card data-testid="google-measurement-settings">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </CardHeader>
      <CardContent>
        {!draft ? (
          configuration.isError ? (
            <div className="flex flex-wrap items-center gap-3">
              <p role="alert" className="text-sm text-destructive">{copy.error}</p>
              <Button type="button" variant="outline" onClick={() => configuration.refetch()} disabled={configuration.isFetching}>
                {configuration.isFetching ? copy.loading : copy.retry}
              </Button>
            </div>
          ) : <p role="status" className="text-sm text-muted-foreground">{copy.loading}</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-5" noValidate>
            <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{copy.configOnly}</p>
            <fieldset disabled={save.isPending} className="grid min-w-0 gap-6 md:grid-cols-2">
              <section className="min-w-0 space-y-4" aria-labelledby="google-analytics-heading">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="google-analytics-heading" className="flex items-center gap-2 font-semibold">
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />{copy.analyticsLabel}
                  </h3>
                  <Badge variant="outline" data-testid="analytics-configuration-status">
                    {persisted?.analytics.enabled ? copy.configured : copy.disabled}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="google-analytics-enabled">{copy.enabled}</Label>
                  <Switch id="google-analytics-enabled" data-testid="switch-google-analytics" checked={draft.analytics.enabled}
                    disabled={save.isPending} aria-label={`${copy.analyticsLabel}: ${copy.enabled}`}
                    onCheckedChange={(enabled) => updateDraft({ ...draft, analytics: { ...draft.analytics, enabled } })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="google-measurement-id">{copy.measurementId}</Label>
                  <Input id="google-measurement-id" data-testid="input-google-measurement-id" value={draft.analytics.measurementId}
                    onChange={(event) => updateDraft({ ...draft, analytics: { ...draft.analytics, measurementId: event.target.value } })}
                    placeholder="G-…" maxLength={22} autoComplete="off" spellCheck={false} dir="ltr"
                    aria-describedby="google-measurement-id-hint" aria-required={draft.analytics.enabled} />
                  <p id="google-measurement-id-hint" className="text-xs text-muted-foreground">{copy.measurementIdHint}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="google-property-id">{copy.propertyId}</Label>
                  <Input id="google-property-id" data-testid="input-google-property-id" value={draft.analytics.propertyId || ''}
                    onChange={(event) => updateDraft({ ...draft, analytics: { ...draft.analytics, propertyId: event.target.value } })}
                    inputMode="numeric" maxLength={30} autoComplete="off" spellCheck={false} dir="ltr" aria-describedby="google-property-id-hint" />
                  <p id="google-property-id-hint" className="text-xs text-muted-foreground">{copy.propertyIdHint}</p>
                </div>
                <Button asChild variant="outline" className="max-w-full">
                  <a href={analyticsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{copy.openAnalytics}</span>
                  </a>
                </Button>
              </section>
              <section className="min-w-0 space-y-4 border-t pt-5 md:border-t-0 md:border-s md:ps-6 md:pt-0" aria-labelledby="google-search-console-heading">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="google-search-console-heading" className="flex items-center gap-2 font-semibold">
                    <Search className="h-4 w-4" aria-hidden="true" />{copy.searchConsoleLabel}
                  </h3>
                  <Badge variant="outline" data-testid="search-console-configuration-status">
                    {persisted?.searchConsole.enabled ? copy.configured : copy.disabled}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="google-search-console-enabled">{copy.enabled}</Label>
                  <Switch id="google-search-console-enabled" data-testid="switch-google-search-console" checked={draft.searchConsole.enabled}
                    disabled={save.isPending} aria-label={`${copy.searchConsoleLabel}: ${copy.enabled}`}
                    onCheckedChange={(enabled) => updateDraft({ ...draft, searchConsole: { ...draft.searchConsole, enabled } })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="google-search-console-property">{copy.property}</Label>
                  <Select disabled={save.isPending} value={draft.searchConsole.property} onValueChange={(property) => updateDraft({ ...draft, searchConsole: {
                    ...draft.searchConsole, property,
                    ...(property === DOMAIN_PROPERTY ? { verificationMethod: 'dns', verificationToken: '' } : {}),
                  } })}>
                    <SelectTrigger id="google-search-console-property" data-testid="select-google-search-console-property" aria-describedby="google-search-console-property-hint" className="min-w-0 text-start">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DOMAIN_PROPERTY}>{DOMAIN_PROPERTY}</SelectItem>
                      <SelectItem value={URL_PROPERTY}>{URL_PROPERTY}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p id="google-search-console-property-hint" className="text-xs text-muted-foreground">{copy.propertyHint}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="google-verification-method">{copy.verificationMethod}</Label>
                  <Select disabled={save.isPending} value={draft.searchConsole.verificationMethod} onValueChange={(method: 'dns' | 'html') => updateDraft({ ...draft, searchConsole: {
                    ...draft.searchConsole, verificationMethod: method,
                    ...(method === 'dns' ? { verificationToken: '' } : {}),
                  } })}>
                    <SelectTrigger id="google-verification-method" data-testid="select-google-verification-method"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dns">{copy.dns}</SelectItem>
                      <SelectItem value="html" disabled={draft.searchConsole.property === DOMAIN_PROPERTY}>{copy.html}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {draft.searchConsole.verificationMethod === 'html' && (
                  <div className="space-y-2">
                    <Label htmlFor="google-verification-token">{copy.verificationToken}</Label>
                    <Input id="google-verification-token" data-testid="input-google-verification-token" value={draft.searchConsole.verificationToken || ''}
                      onChange={(event) => updateDraft({ ...draft, searchConsole: { ...draft.searchConsole, verificationToken: event.target.value } })}
                      maxLength={512} autoComplete="off" spellCheck={false} dir="ltr" aria-describedby="google-verification-token-hint" aria-required={draft.searchConsole.enabled} />
                    <p id="google-verification-token-hint" className="text-xs text-muted-foreground">{copy.verificationTokenHint}</p>
                  </div>
                )}
                <Button asChild variant="outline" className="max-w-full">
                  <a href={searchConsoleUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{copy.openSearchConsole}</span>
                  </a>
                </Button>
              </section>
            </fieldset>
            {(invalidSettings || save.isError) && (
              <p role="alert" className="text-sm text-destructive">{invalidSettings ? copy.invalidSettings : copy.error}</p>
            )}
            <Button type="submit" disabled={save.isPending} data-testid="button-save-google-measurement">
              {save.isPending ? copy.saving : copy.save}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
