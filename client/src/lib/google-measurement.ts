/**
 * Optional, public-page-only measurement. Google runs in an empty frame so its
 * automatic DOM/history listeners cannot observe the Academy's forms or panels.
 * Destroying that frame also destroys its timers and listeners on withdrawal.
 */
import { isEmailMessageId, type EmailMessageId } from '@shared/email-attribution';
export const MEASUREMENT_CONSENT_KEY = 'fas_optional_analytics_v1';
export const MEASUREMENT_COOKIE_PREFIX = 'fas_analytics';
const CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;
const PUBLIC_PATHS = new Set(['/', '/login', '/signup']);
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;
const CSP_DIAGNOSTIC_DIRECTIVES = new Set(['connect-src', 'script-src', 'script-src-elem', 'script-src-attr', 'img-src', 'frame-src', 'child-src', 'default-src', 'worker-src', 'style-src', 'style-src-elem', 'style-src-attr', 'font-src', 'media-src', 'object-src', 'base-uri', 'form-action', 'manifest-src', 'frame-ancestors']);

export type MeasurementConsent = 'accepted' | 'declined' | null;
export type MeasurementConfig = {
  analyticsEnabled: boolean;
  measurementId: string | null;
  consentRequired: true;
};
export type MeasurementPage = { page_location: string; page_referrer: string; page_title: string; campaign_source?: 'newsletter'; campaign_medium?: 'email'; campaign_name?: 'academy_launch_2026'; campaign_content?: EmailMessageId };
type TagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
export type MeasurementTransport = { pageView: (page: MeasurementPage) => void; signUp?: (page: MeasurementPage, method: 'promo' | 'standard') => void; stop: () => void };
export function emailCampaignFields(messageId: unknown): Partial<MeasurementPage> {
  return isEmailMessageId(messageId) ? { campaign_source: 'newsletter', campaign_medium: 'email', campaign_name: 'academy_launch_2026', campaign_content: messageId } : {};
}

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

export const MEASUREMENT_FRAME_PATH = '/api/public/measurement-frame';

export function createGoogleTagTransport(win: Window, measurementId: string, initialPage: MeasurementPage): MeasurementTransport {
  if (!MEASUREMENT_ID.test(measurementId)) throw new Error('Invalid measurement ID');
  const frameUrl = new URL(MEASUREMENT_FRAME_PATH, win.location.origin);
  if (!['http:', 'https:'].includes(frameUrl.protocol)) throw new Error('Invalid measurement origin');
  const frame = win.document.createElement('iframe');
  frame.hidden = true;
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('data-academy-measurement', '');
  frame.setAttribute('data-document-initialized', 'false');
  frame.setAttribute('data-tag-status', 'frame-loading');
  frame.referrerPolicy = 'no-referrer';
  let stopped = false;
  let initialized = false;
  let tagWindow: TagWindow | null = null;
  let gtag: ((...args: unknown[]) => void) | null = null;
  let queuedPages: { page: MeasurementPage; method?: 'promo' | 'standard' }[] = [];
  let removePolicyListener = () => {};
  const stop = () => {
    if (stopped) return;
    stopped = true;
    // Disable before removing the document, including during a pending load.
    setDisabled(win, measurementId, true);
    if (tagWindow) {
      setDisabled(tagWindow, measurementId, true);
      if (tagWindow.dataLayer) tagWindow.dataLayer.length = 0;
    }
    queuedPages = [];
    removePolicyListener();
    frame.onload = null;
    frame.onerror = null;
    frame.remove();
  };
  const sendPage = (page: MeasurementPage, method?: 'promo' | 'standard') => {
    if (stopped || !gtag) return;
    // Also update defaults for unavoidable GA session/engagement events.
    gtag('set', page);
    gtag('event', method ? 'sign_up' : 'page_view', { ...page, ...(method ? { method } : {}), send_to: measurementId });
  };
  frame.onload = () => {
    if (stopped) return;
    try {
      const loadedWindow = frame.contentWindow as TagWindow | null;
      if (!loadedWindow) throw new Error('Measurement frame unavailable');
      const location = new URL(loadedWindow.location.href);
      // Some browsers emit an initial empty-document load. Google itself
      // aborts on about: URLs, so never initialize against that document.
      if (location.href === 'about:blank') return;
      if (location.href !== frameUrl.href) throw new Error('Unexpected measurement frame');
      if (initialized) return;
      tagWindow = loadedWindow;
      const tagDocument = frame.contentDocument;
      if (!tagDocument?.head) throw new Error('Measurement document unavailable');
      const onPolicyViolation = (event: SecurityPolicyViolationEvent) => {
        if (stopped || !CSP_DIAGNOSTIC_DIRECTIVES.has(event.effectiveDirective)) return;
        let hostname = '';
        try {
          const blocked = new URL(event.blockedURI);
          if (blocked.protocol === 'https:' || blocked.protocol === 'http:') hostname = blocked.hostname;
        } catch { /* Inline/eval violations have no hostname to expose. */ }
        frame.setAttribute('data-csp-blocked-directive', event.effectiveDirective);
        frame.setAttribute('data-csp-blocked-host', hostname);
      };
      tagDocument.addEventListener('securitypolicyviolation', onPolicyViolation);
      removePolicyListener = () => tagDocument.removeEventListener('securitypolicyviolation', onPolicyViolation);
      const referrerPolicy = tagDocument.createElement('meta');
      referrerPolicy.name = 'referrer';
      referrerPolicy.content = 'no-referrer';
      tagDocument.head.appendChild(referrerPolicy);
      setDisabled(win, measurementId, false);
      setDisabled(loadedWindow, measurementId, false);
      loadedWindow.dataLayer = [];
      loadedWindow.gtag = function () { loadedWindow.dataLayer!.push(arguments); };
      gtag = loadedWindow.gtag;
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
      const script = tagDocument.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      // Diagnostics expose no paths, queries, cookie names/values or IDs.
      frame.setAttribute('data-tag-status', 'loading');
      script.onload = () => {
        if (stopped) return;
        frame.setAttribute('data-tag-status', 'loaded');
        let cookiePresent = false;
        try {
          cookiePresent = tagDocument.cookie.split(';').some(cookie => cookie.trim().split('=')[0].startsWith(MEASUREMENT_COOKIE_PREFIX + '_'));
        } catch { /* Cookie access may be blocked. */ }
        frame.setAttribute('data-analytics-cookie-present', String(cookiePresent));
      };
      script.onerror = () => { if (!stopped) frame.setAttribute('data-tag-status', 'error'); };
      initialized = true;
      frame.setAttribute('data-document-initialized', 'true');
      for (const event of queuedPages) sendPage(event.page, event.method);
      queuedPages = [];
      // Queue consent, sanitized globals and pending views before the SDK loads.
      tagDocument.head.appendChild(script);
    } catch {
      stop();
    }
  };
  frame.onerror = stop;
  frame.src = frameUrl.href;
  try {
    // This dedicated same-origin document contains no app data or UI. Its
    // HTTP(S) protocol is required by the real Google Analytics SDK.
    win.document.body.appendChild(frame);
  } catch (error) {
    stop();
    throw error;
  }
  return {
    pageView(page) {
      if (stopped) return;
      if (initialized) sendPage(page);
      else queuedPages.push({ page: { ...page } });
    },
    signUp(page, method) {
      if (stopped || (method !== 'promo' && method !== 'standard')) return;
      if (initialized) sendPage(page, method);
      else queuedPages.push({ page: { ...page }, method });
    },
    stop,
  };
}

export function createMeasurementController(win: Window, createTransport = createGoogleTagTransport, email?: { messageId: () => EmailMessageId | null; pause: () => void }) {
  let config: MeasurementConfig | null = null;
  let consent: MeasurementConsent = null;
  let permitted = false;
  let transport: MeasurementTransport | null = null;
  let lastPage = '';
  let previousPublicPage = sanitizeMeasurementLocation(win.document.referrer, win.location.origin);
  let activeId: string | null = null;
  let publicRoute = !!sanitizeMeasurementLocation(win.location.href, win.location.origin);
  let configEpoch = 0;
  let activeMessage: EmailMessageId | null = null;
  let lastMeasurementPage: MeasurementPage | null = null;
  const stop = () => {
    if (activeId) setDisabled(win, activeId, true);
    transport?.stop();
    transport = null;
    activeId = null;
    lastPage = '';
    lastMeasurementPage = null;
    activeMessage = null;
  };
  const invalidateConfig = () => {
    email?.pause();
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
    const messageId = email?.messageId() || null;
    // A fresh frame clears old global campaign defaults on expiry/source change.
    if (transport && activeMessage !== messageId) stop();
    if (location === lastPage) return;
    const path = new URL(location).pathname;
    const page: MeasurementPage = {
      page_location: location,
      page_referrer: previousPublicPage,
      // Never read user-controlled DOM titles or account details.
      page_title: path === '/login' ? 'Find And Study Academy | Sign in' : path === '/signup' ? 'Find And Study Academy | Sign up' : 'Find And Study Academy',
      ...emailCampaignFields(messageId),
    };
    try {
      if (!transport) {
        activeId = config.measurementId;
        transport = createTransport(win, activeId, page);
        activeMessage = messageId;
      }
      transport.pageView(page);
      lastPage = location;
      previousPublicPage = location;
      lastMeasurementPage = page;
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
    signUp(method: 'promo' | 'standard') {
      if (method !== 'promo' && method !== 'standard') return;
      if (win.location.pathname !== '/signup' || !permitted || consent !== 'accepted' || !config?.analyticsEnabled) return;
      sync();
      if (transport && lastMeasurementPage) transport.signUp?.(lastMeasurementPage, method);
    },
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
