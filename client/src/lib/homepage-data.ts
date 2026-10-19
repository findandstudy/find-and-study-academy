export type TrainingDestination = {code: string; name: string};

// Keep the published training order consistent with the invitation emails.
const DESTINATION_ORDER = ['AZ','BY','CA','CN','CZ','EE','DE','IT','LV','LT','MT','PL','ES','TR','GB','US'];

export function readTrainingDestinations(response: unknown): TrainingDestination[] | null {
  if (!response || typeof response !== 'object') return null;
  const data = response as {success?: unknown; countries?: unknown};
  if (data.success !== true || !Array.isArray(data.countries)) return null;
  const countries = new Map<string, TrainingDestination>();
  for (const value of data.countries) {
    if (!value || typeof value !== 'object' || typeof value.code !== 'string') continue;
    const code = value.code.trim().toUpperCase();
    // The Academy introduction is a section, not a training destination.
    if (!/^[A-Z]{2}$/.test(code) || countries.has(code)) continue;
    countries.set(code, {code, name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : code});
  }
  const rank = (code: string) => {
    const index = DESTINATION_ORDER.indexOf(code);
    return index < 0 ? DESTINATION_ORDER.length : index;
  };
  return Array.from(countries.values()).sort((a, b) => rank(a.code) - rank(b.code) || a.code.localeCompare(b.code, 'en'));
}

export function destinationLabel(country: TrainingDestination, locale: string, translatedLabel?: string): string {
  if (translatedLabel?.trim()) return translatedLabel;
  try {
    const label = new Intl.DisplayNames([locale], {type: 'region'}).of(country.code);
    if (label && label !== country.code) return label;
  } catch { /* Some browsers do not have DisplayNames or the requested locale. */ }
  return country.name;
}

export function normalizeInvitationCode(value: string): string {
  // Only ASCII letters belong to invitation codes; Unicode case folding must
  // not turn an otherwise invalid code into an accepted signup parameter.
  return value.trim().replace(/[a-z]/g, letter => letter.toUpperCase());
}

export function isInvitationCode(value: string): boolean {
  return /^[A-Z0-9-]{6,64}$/.test(value);
}

export type CampaignOffer = {
  accessDays: number;
  expiresAt: string;
  deviceLimit: 2;
  emailVerificationRequired: true;
  administratorApprovalRequired: true;
};

export type CampaignPreview =
  | {status: 'idle' | 'checking' | 'unavailable'; promoCode: string}
  | {status: 'confirmed'; promoCode: string; campaign: CampaignOffer};

export function readCampaignOffer(response: unknown): CampaignOffer | null {
  if (!response || typeof response !== 'object') return null;
  const data = response as {success?: unknown; campaign?: Partial<CampaignOffer>};
  const offer = data.campaign;
  if (data.success !== true || !offer || !Number.isSafeInteger(offer.accessDays) || (offer.accessDays ?? 0) <= 0 ||
      typeof offer.expiresAt !== 'string' || !Number.isFinite(Date.parse(offer.expiresAt)) ||
      offer.deviceLimit !== 2 || offer.emailVerificationRequired !== true || offer.administratorApprovalRequired !== true) return null;
  return {accessDays: offer.accessDays!, expiresAt: offer.expiresAt, deviceLimit: 2, emailVerificationRequired: true, administratorApprovalRequired: true};
}

/** Read-only lookup. Cleanup also guards against fetch implementations that ignore abort. */
export function startCampaignPreview(
  promoCode: string,
  onChange: (preview: CampaignPreview) => void,
  fetcher: typeof fetch = fetch,
  delay = 500,
  requestTimeoutMs = 10_000,
): () => void {
  if (!isInvitationCode(promoCode)) {
    onChange({status: 'idle', promoCode});
    return () => {};
  }
  let current = true;
  let requestTimeout: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  onChange({status: 'checking', promoCode});
  const timer = setTimeout(async () => {
    requestTimeout = setTimeout(() => {
      if (!current) return;
      current = false;
      controller.abort();
      onChange({status: 'unavailable', promoCode});
    }, requestTimeoutMs);
    try {
      const response = await fetcher('/api/public/campaign-preview', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'omit',
        body: JSON.stringify({promoCode}),
        signal: controller.signal,
      });
      const campaign = response.ok ? readCampaignOffer(await response.json()) : null;
      if (current) onChange(campaign ? {status: 'confirmed', promoCode, campaign} : {status: 'unavailable', promoCode});
    } catch {
      if (current) onChange({status: 'unavailable', promoCode});
    } finally {
      clearTimeout(requestTimeout);
    }
  }, delay);
  return () => {
    current = false;
    clearTimeout(timer);
    clearTimeout(requestTimeout);
    controller.abort();
  };
}

export function formatCampaignDeadline(expiresAt: string, locale: string): string {
  const date = new Date(expiresAt);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Istanbul', calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  };
  try { return new Intl.DateTimeFormat(locale, options).format(date); } catch { /* Try a broadly supported locale. */ }
  try { return new Intl.DateTimeFormat('en', options).format(date); } catch { /* Keep Türkiye time even without Intl timezone support. */ }
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}
