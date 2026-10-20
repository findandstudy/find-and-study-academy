import { EMAIL_ATTRIBUTION_WINDOW_DAYS, isEmailMessageId, parseEmailMessageId, type EmailMessageId } from '@shared/email-attribution';

export const EMAIL_ATTRIBUTION_STORAGE_KEY = 'fas_email_attribution_v1';
const WINDOW_MS = EMAIL_ATTRIBUTION_WINDOW_DAYS * 86400_000;
const VISIT_MS = 30 * 60_000;
const PUBLIC_PATHS = new Set(['/', '/login', '/signup']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
type Consent = 'accepted' | 'declined' | null;
export type SignupMethod = 'promo' | 'standard';
type Receipt = { messageId: EmailMessageId; visitId: string; startedAt: number; expiresAt: number; token?: string };
type AttributionState = { version: 1; lastMessageId: EmailMessageId; visits: Receipt[] };
type Context = { consent: Consent; enabled: boolean; anonymous: boolean };
type Options = { fetcher?: typeof fetch; now?: () => number; randomUUID?: () => string; isAnonymous?: () => boolean };
let navigationMessage: EmailMessageId | null = null;
const clients = new WeakMap<Window, ReturnType<typeof createEmailAttributionClient>>();
const signupListeners = new Set<(method: SignupMethod) => void>();

const validToken = (value: unknown): value is string => typeof value === 'string' && value.length <= 1536 && TOKEN.test(value);

/** Reconstruct public links from finite campaign values, never copy a query. */
export function publicEmailHref(path: string, promo?: string, win: Window = window): string {
  if (!PUBLIC_PATHS.has(path)) return path;
  if (!PUBLIC_PATHS.has(win.location.pathname)) { navigationMessage = null; return path; }
  const found = parseEmailMessageId(win.location.search);
  if (found) navigationMessage = found;
  const message = found || navigationMessage || clients.get(win)?.storedMessageId() || null;
  const query = new URLSearchParams();
  if (path === '/signup' && promo && /^[A-Z0-9][A-Z0-9-]{5,63}$/.test(promo)) query.set('promo', promo);
  if (message) {
    query.set('utm_source', 'newsletter'); query.set('utm_medium', 'email');
    query.set('utm_campaign', 'academy_launch_2026'); query.set('utm_content', message);
  }
  return path + (query.size ? '?' + query.toString() : '');
}

function readState(value: string | null, now: number): AttributionState | null {
  try {
    const parsed = JSON.parse(value || 'null');
    if (parsed?.version !== 1 || !isEmailMessageId(parsed.lastMessageId) || !Array.isArray(parsed.visits)) return null;
    const visits: Receipt[] = [];
    for (const entry of parsed.visits.slice(0, 10)) {
      if (!isEmailMessageId(entry?.messageId) || !UUID.test(entry.visitId) || !Number.isFinite(entry.startedAt) || entry.startedAt > now || now - entry.startedAt >= WINDOW_MS || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= now || entry.expiresAt > entry.startedAt + WINDOW_MS + 60_000 || (entry.token !== undefined && !validToken(entry.token))) continue;
      if (visits.some(visit => visit.messageId === entry.messageId)) continue;
      visits.push({ messageId: entry.messageId, visitId: entry.visitId, startedAt: entry.startedAt, expiresAt: entry.expiresAt, ...(entry.token ? { token: entry.token } : {}) });
    }
    return visits.some(visit => visit.messageId === parsed.lastMessageId) ? { version: 1, lastMessageId: parsed.lastMessageId, visits } : null;
  } catch { return null; }
}

export function createEmailAttributionClient(win: Window, options: Options = {}) {
  const now = options.now || Date.now;
  const fetcher = options.fetcher || ((input, init) => win.fetch(input, init));
  const randomUUID = options.randomUUID || (() => win.crypto.randomUUID());
  const anonymous = options.isAnonymous || (() => true);
  let context: Context = { consent: null, enabled: false, anonymous: false };
  let active = false;
  let loaded = false;
  let state: AttributionState | null = null;
  let capturedEntryKey: string | null = null;
  let epoch = 0;
  let pending: { messageId: EmailMessageId; visitId: string; request: AbortController; promise: Promise<void>; timeout: number } | null = null;
  const eligible = () => active && context.consent === 'accepted' && context.enabled && context.anonymous && anonymous() && PUBLIC_PATHS.has(win.location.pathname);
  const persist = () => {
    if (!eligible() || !state) return;
    try { win.localStorage.setItem(EMAIL_ATTRIBUTION_STORAGE_KEY, JSON.stringify(state)); } catch { /* Current-page attribution remains available. */ }
  };
  const invalidate = () => { epoch++; if (pending) { win.clearTimeout(pending.timeout); pending.request.abort(); } pending = null; };
  const clear = () => {
    invalidate(); state = null; loaded = false; navigationMessage = null; capturedEntryKey = null;
    try { win.localStorage.removeItem(EMAIL_ATTRIBUTION_STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
  };
  const selected = (): Receipt | null => {
    if (!state) return null;
    const entry = state.visits.find(visit => visit.messageId === state!.lastMessageId);
    return entry && entry.expiresAt > now() && now() - entry.startedAt < WINDOW_MS ? entry : null;
  };
  const ensureReceipt = (entry: Receipt) => {
    if (!eligible() || entry.token || now() - entry.startedAt >= VISIT_MS || pending?.visitId === entry.visitId) return;
    invalidate();
    const requestEpoch = epoch;
    const request = new AbortController();
    const timeout = win.setTimeout(() => request.abort(), 5000);
    const promise = (async () => {
      try {
        const response = await fetcher('/api/public/email-attribution/visit', {
          method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: request.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ messageId: entry.messageId, visitId: entry.visitId, consent: true }),
        });
        const result = response.ok ? await response.json() : null;
        const expiresAt = Date.parse(result?.expiresAt);
        if (epoch !== requestEpoch || request.signal.aborted || !eligible() || selected()?.visitId !== entry.visitId || result?.success !== true || !validToken(result.token) || !Number.isFinite(expiresAt) || expiresAt <= now() || expiresAt > entry.startedAt + WINDOW_MS + 60_000) return;
        entry.token = result.token; entry.expiresAt = expiresAt;
        persist();
      } catch { /* Attribution failure must never block registration. */ }
      finally {
        win.clearTimeout(timeout);
        if (pending?.request === request) pending = null;
      }
    })();
    pending = { messageId: entry.messageId, visitId: entry.visitId, request, promise, timeout };
  };
  const synchronize = () => {
    if (!eligible()) return;
    if (!loaded) {
      loaded = true;
      try { state = readState(win.localStorage.getItem(EMAIL_ATTRIBUTION_STORAGE_KEY), now()); } catch { state = null; }
      if (!state) { try { win.localStorage.removeItem(EMAIL_ATTRIBUTION_STORAGE_KEY); } catch {} }
    }
    if (state && !selected()) {
      invalidate(); state = null;
      try { win.localStorage.removeItem(EMAIL_ATTRIBUTION_STORAGE_KEY); } catch {}
    }
    const found = parseEmailMessageId(win.location.search);
    const entryKey = found ? win.location.pathname + ':' + found : null;
    if (found && capturedEntryKey !== entryKey) {
      capturedEntryKey = entryKey;
      navigationMessage = found;
      let entry = state?.visits.find(visit => visit.messageId === found);
      if (!entry || now() - entry.startedAt >= VISIT_MS || entry.expiresAt <= now()) {
        let visitId: string;
        try { visitId = randomUUID(); } catch { return; }
        if (!UUID.test(visitId)) return;
        entry = { messageId: found, visitId, startedAt: now(), expiresAt: now() + WINDOW_MS };
        state = { version: 1, lastMessageId: found, visits: [...(state?.visits.filter(visit => visit.messageId !== found && visit.expiresAt > now()) || []), entry] };
      } else state!.lastMessageId = found;
      if (pending && pending.messageId !== found) invalidate();
      persist();
    } else if (!found) capturedEntryKey = null;
    const entry = selected();
    if (entry) ensureReceipt(entry);
  };
  return {
    setContext(value: Context) {
      const wasActive = active;
      context = value;
      active = value.consent === 'accepted' && value.enabled && value.anonymous && anonymous() && PUBLIC_PATHS.has(win.location.pathname);
      if (value.consent !== 'accepted') clear();
      else if (!active && wasActive) invalidate();
      if (active) synchronize();
    },
    pause() { active = false; capturedEntryKey = null; invalidate(); },
    storageChanged() {
      invalidate(); state = null; loaded = false;
      if (eligible()) {
        loaded = true;
        try { state = readState(win.localStorage.getItem(EMAIL_ATTRIBUTION_STORAGE_KEY), now()); } catch {}
      }
    },
    messageId(): EmailMessageId | null { synchronize(); return eligible() ? selected()?.messageId || null : null; },
    storedMessageId(): EmailMessageId | null { return eligible() ? selected()?.messageId || null : null; },
    currentToken(): string | undefined { return eligible() && win.location.pathname === '/signup' ? selected()?.token : undefined; },
    async registrationToken(waitMs = 2000): Promise<string | undefined> {
      synchronize();
      const requestEpoch = epoch;
      let timeout: number | undefined;
      if (pending) {
        try { await Promise.race([pending.promise, new Promise<void>(resolve => { timeout = win.setTimeout(resolve, Math.min(2000, Math.max(0, waitMs))); })]); }
        finally { win.clearTimeout(timeout); }
      }
      return epoch === requestEpoch && eligible() && win.location.pathname === '/signup' ? selected()?.token : undefined;
    },
    destroy() { active = false; invalidate(); },
  };
}

export function emailAttributionClient(win: Window = window, options?: Options) {
  let client = clients.get(win);
  if (!client) { client = createEmailAttributionClient(win, options); clients.set(win, client); }
  return client;
}

export function allowedSignupAttributionToken(value: unknown): string | undefined {
  if (typeof window === 'undefined' || !validToken(value)) return undefined;
  const token = clients.get(window)?.currentToken();
  return token === value ? token : undefined;
}

export function onSuccessfulSignup(listener: (method: SignupMethod) => void) {
  signupListeners.add(listener);
  return () => { signupListeners.delete(listener); };
}
export function recordSuccessfulSignup(method: SignupMethod) {
  if (method !== 'promo' && method !== 'standard') return;
  signupListeners.forEach(listener => { try { listener(method); } catch { /* Measurement never blocks a successful registration. */ } });
}
