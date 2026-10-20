/**
 * Optional, public-page-only measurement. Google runs in an empty frame so its
 * automatic DOM/history listeners cannot observe the Academy's forms or panels.
 * Destroying that frame also destroys its timers and listeners on withdrawal.
 */
export const MEASUREMENT_CONSENT_KEY = 'fas_optional_analytics_v1';
export const MEASUREMENT_COOKIE_PREFIX = 'fas_analytics';
const CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;
const PUBLIC_PATHS = new Set(['/', '/login', '/signup']);
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;

export type MeasurementConsent = 'accepted' | 'declined' | null;
export type MeasurementConfig = {
  analyticsEnabled: boolean;
  measurementId: string | null;
  consentRequired: true;
};
export type MeasurementPage = { page_location: string; page_referrer: string; page_title: string };
type TagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
export type MeasurementTransport = { pageView: (page: MeasurementPage) => void; stop: () => void };

export function isMeasurementPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export function readMeasurementConfig(value: unknown): MeasurementConfig | null {
  if (!value || typeof value !== 'object') return null;
  const config = value as Record<string, unknown>;
  if (config.success !== true || typeof config.analyticsEnabled !== 'boolean' || config.consentRequired !== true) return null;
  if (config.measurementId !== null && (typeof config.measurementId !== 'string' || !MEASUREMENT_ID.test(config.measurementId))) return null;
  if (config.analyticsEnabled && !config.measurementId) return null;
  return { analyticsEnabled: config.analyticsEnabled, measurementId: config.measurementId as string | null, consentRequired: true };
}

/** Drop every query and fragment, including campaign codes and login tokens. */
export function sanitizeMeasurementLocation(value: string, origin: string): string {
  try {
    const base = new URL(origin);
    const url = new URL(value, base.origin);
    if (!['http:', 'https:'].includes(base.protocol) || url.origin !== base.origin || url.username || url.password || !isMeasurementPublicPath(url.pathname)) return '';
    return base.origin + url.pathname;
  } catch { return ''; }
}

export function readMeasurementConsent(storage: Pick<Storage, 'getItem'>, now = Date.now()): MeasurementConsent {
  try {
    const saved = JSON.parse(storage.getItem(MEASUREMENT_CONSENT_KEY) || 'null');
    if (!saved || !['accepted', 'declined'].includes(saved.choice) || typeof saved.updatedAt !== 'number' || saved.updatedAt > now || now - saved.updatedAt > CONSENT_MAX_AGE) return null;
    return saved.choice;
  } catch { return null; }
}

export function saveMeasurementConsent(storage: Pick<Storage, 'setItem'>, choice: Exclude<MeasurementConsent, null>): void {
  try { storage.setItem(MEASUREMENT_CONSENT_KEY, JSON.stringify({ choice, updatedAt: Date.now() })); } catch { /* Current-page choice still applies when storage is blocked. */ }
}

export function clearMeasurementCookies(doc: Document, hostname: string): void {
  const names = doc.cookie.split(';').map(cookie => cookie.trim().split('=')[0]).filter(name => name.startsWith(MEASUREMENT_COOKIE_PREFIX + '_'));
  const parts = hostname.split('.');
  for (const name of names) {
    doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    for (let i = 0; i < parts.length - 1; i++) {
      const domain = parts.slice(i).join('.');
      doc.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax`;
      doc.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${domain}; SameSite=Lax`;
    }
  }
}

function setDisabled(target: Window, id: string, disabled: boolean): void {
  (target as unknown as Record<string, unknown>)[`ga-disable-${id}`] = disabled;
}

export function createGoogleTagTransport(win: Window, measurementId: string, initialPage: MeasurementPage): MeasurementTransport {
  if (!MEASUREMENT_ID.test(measurementId)) throw new Error('Invalid measurement ID');
  const frame = win.document.createElement('iframe');
  frame.hidden = true;
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('data-academy-measurement', '');
  frame.referrerPolicy = 'no-referrer';
  // No navigation, forms, inputs, chat, or app history exists in this document.
  win.document.body.appendChild(frame);
  const tagWindow = frame.contentWindow as TagWindow | null;
  const tagDocument = frame.contentDocument;
  if (!tagWindow || !tagDocument) { frame.remove(); throw new Error('Measurement frame unavailable'); }
  const referrerPolicy = tagDocument.createElement('meta');
  referrerPolicy.name = 'referrer';
  referrerPolicy.content = 'no-referrer';
  tagDocument.head.appendChild(referrerPolicy);
  setDisabled(win, measurementId, false);
  setDisabled(tagWindow, measurementId, false);
  tagWindow.dataLayer = [];
  tagWindow.gtag = function () { tagWindow.dataLayer!.push(arguments); };
  const gtag = tagWindow.gtag;
  gtag('consent', 'default', {
    analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    functionality_storage: 'denied', personalization_storage: 'denied', security_storage: 'granted',
  });
  gtag('set', {
    ...initialPage,
    allow_google_signals: false, allow_ad_personalization_signals: false,
    ads_data_redaction: true, url_passthrough: false, send_page_view: false,
  });
  gtag('js', new Date());
  gtag('config', measurementId, {
    ...initialPage, send_page_view: false,
    allow_google_signals: false, allow_ad_personalization_signals: false,
    cookie_prefix: MEASUREMENT_COOKIE_PREFIX, cookie_path: '/', cookie_flags: 'SameSite=Lax;Secure',
    ignore_referrer: true,
  });
  let stopped = false;
  const script = tagDocument.createElement('script');
  script.async = true;
  script.referrerPolicy = 'no-referrer';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  tagDocument.head.appendChild(script);
  return {
    pageView(page) {
      if (stopped) return;
      // Also update defaults for unavoidable GA session/engagement events.
      gtag('set', page);
      gtag('event', 'page_view', { ...page, send_to: measurementId });
    },
    stop() {
      if (stopped) return;
      stopped = true;
      // Do this before destroying the frame: even unload events must be denied.
      setDisabled(win, measurementId, true);
      setDisabled(tagWindow, measurementId, true);
      tagWindow.dataLayer!.length = 0;
      frame.remove();
    },
  };
}

export function createMeasurementController(win: Window, createTransport = createGoogleTagTransport) {
  let config: MeasurementConfig | null = null;
  let consent: MeasurementConsent = null;
  let permitted = false;
  let transport: MeasurementTransport | null = null;
  let lastPage = '';
  let previousPublicPage = sanitizeMeasurementLocation(win.document.referrer, win.location.origin);
  let activeId: string | null = null;
  let publicRoute = !!sanitizeMeasurementLocation(win.location.href, win.location.origin);
  let configEpoch = 0;
  const stop = () => {
    if (activeId) setDisabled(win, activeId, true);
    transport?.stop();
    transport = null;
    activeId = null;
    lastPage = '';
  };
  const invalidateConfig = () => {
    config = null;
    configEpoch++;
    stop();
    previousPublicPage = '';
  };
  const sync = () => {
    const location = sanitizeMeasurementLocation(win.location.href, win.location.origin);
    if (!location) {
      if (publicRoute) invalidateConfig();
      publicRoute = false;
      config = null;
    } else publicRoute = true;
    if (!location || !permitted || consent !== 'accepted' || !config?.analyticsEnabled || !config.measurementId) {
      stop();
      if (!location || !permitted) previousPublicPage = '';
      return;
    }
    if (activeId && activeId !== config.measurementId) stop();
    if (location === lastPage) return;
    const path = new URL(location).pathname;
    const page: MeasurementPage = {
      page_location: location,
      page_referrer: previousPublicPage,
      // Never read user-controlled DOM titles or account details.
      page_title: path === '/login' ? 'Find And Study Academy | Sign in' : path === '/signup' ? 'Find And Study Academy | Sign up' : 'Find And Study Academy',
    };
    try {
      if (!transport) {
        activeId = config.measurementId;
        transport = createTransport(win, activeId, page);
      }
      transport.pageView(page);
      lastPage = location;
      previousPublicPage = location;
    } catch { stop(); }
  };
  const originals = { pushState: win.history.pushState, replaceState: win.history.replaceState };
  const wrappers = {} as typeof originals;
  for (const method of ['pushState', 'replaceState'] as const) {
    wrappers[method] = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
      // Stop synchronously BEFORE router/provider listeners can see private URLs.
      if (url != null && !sanitizeMeasurementLocation(String(url), win.location.origin)) {
        invalidateConfig();
        publicRoute = false;
      }
      const result = originals[method].call(this, data, unused, url);
      sync();
      return result;
    };
    win.history[method] = wrappers[method];
  }
  win.addEventListener('popstate', sync, true);
  win.addEventListener('hashchange', sync, true);
  win.addEventListener('pagehide', invalidateConfig, true);
  win.addEventListener('pageshow', sync, true);
  return {
    setConfig(value: MeasurementConfig | null) { config = value; sync(); },
    getConfigEpoch() { return configEpoch; },
    setPermitted(value: boolean) {
      // Preserve initial setConfig → setPermitted ordering, but an eligibility
      // loss must never retain an enabled configuration for a later return.
      if (permitted && !value) invalidateConfig();
      permitted = value;
      sync();
    },
    setConsent(value: MeasurementConsent) {
      consent = value;
      if (value !== 'accepted') {
        stop();
        clearMeasurementCookies(win.document, win.location.hostname);
      }
      sync();
    },
    destroy() {
      stop();
      for (const method of ['pushState', 'replaceState'] as const) if (win.history[method] === wrappers[method]) win.history[method] = originals[method];
      win.removeEventListener('popstate', sync, true);
      win.removeEventListener('hashchange', sync, true);
      win.removeEventListener('pagehide', invalidateConfig, true);
      win.removeEventListener('pageshow', sync, true);
    },
  };
}
