import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/store/auth';
import { useGoogleMeasurementCopy } from '@/lib/google-measurement-copy';
import { EMAIL_ATTRIBUTION_STORAGE_KEY, emailAttributionClient, onSuccessfulSignup } from '@/lib/email-attribution';
import {
  createMeasurementController, isMeasurementPublicPath, MEASUREMENT_CONSENT_KEY,
  readMeasurementConfig, readMeasurementConsent, saveMeasurementConsent,
  type MeasurementConfig, type MeasurementConsent,
} from '@/lib/google-measurement';

function storedConsent(): MeasurementConsent {
  try { return readMeasurementConsent(window.localStorage); } catch { return null; }
}

export function GoogleMeasurement() {
  const [location] = useLocation();
  const { user, role, isLoading } = useAuthStore();
  const copy = useGoogleMeasurementCopy();
  const [authReady, setAuthReady] = useState(false);
  const [consent, setConsent] = useState<MeasurementConsent>(storedConsent);
  const [config, setConfig] = useState<MeasurementConfig | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const controller = useRef<ReturnType<typeof createMeasurementController> | null>(null);
  const email = useRef<ReturnType<typeof emailAttributionClient> | null>(null);
  const emailContext = useRef({ consent, enabled: false, anonymous: false });
  const eligible = useRef(false);
  const publicPage = isMeasurementPublicPath(location);
  const permitted = authReady && !user && !role;

  useEffect(() => { if (!isLoading) setAuthReady(true); }, [isLoading]);

  useLayoutEffect(() => {
    const attribution = emailAttributionClient(window, { isAnonymous: () => !useAuthStore.getState().user && !useAuthStore.getState().role });
    email.current = attribution;
    const measurement = createMeasurementController(window, undefined, attribution);
    const unsubscribe = onSuccessfulSignup(method => measurement.signUp(method));
    controller.current = measurement;
    return () => { unsubscribe(); attribution.destroy(); measurement.destroy(); controller.current = null; email.current = null; };
  }, []);
  useLayoutEffect(() => {
    eligible.current = publicPage && permitted;
    emailContext.current.anonymous = eligible.current;
    if (!eligible.current) emailContext.current.enabled = false;
    email.current?.setContext(emailContext.current);
    controller.current?.setPermitted(permitted);
    if (!eligible.current) {
      controller.current?.setConfig(null);
      setConfig(null);
    }
  }, [publicPage, permitted]);
  useLayoutEffect(() => {
    emailContext.current.consent = consent;
    email.current?.setContext(emailContext.current);
    controller.current?.setConsent(consent);
  }, [consent]);

  useEffect(() => {
    if (!publicPage || !permitted) return;
    let active = true;
    let pending: AbortController | null = null;
    let timeout: number | undefined;
    const applyConfig = (value: MeasurementConfig | null, epoch: number) => {
      const auth = useAuthStore.getState();
      if (!active || !eligible.current || auth.user || auth.role || !isMeasurementPublicPath(window.location.pathname) || controller.current?.getConfigEpoch() !== epoch) return;
      emailContext.current.enabled = value?.analyticsEnabled === true;
      email.current?.setContext(emailContext.current);
      controller.current?.setConfig(value);
      setConfig(value);
    };
    const refresh = () => {
      if (!active || pending) return;
      const epoch = controller.current?.getConfigEpoch();
      if (epoch === undefined) return;
      const request = new AbortController();
      pending = request;
      timeout = window.setTimeout(() => request.abort(), 8000);
      fetch('/api/public/measurement-config', {
        method: 'GET', credentials: 'omit', cache: 'no-store', signal: request.signal,
        headers: { Accept: 'application/json' },
      }).then(async response => response.ok ? readMeasurementConfig(await response.json()) : null)
        .then(value => applyConfig(value, epoch))
        .catch(() => applyConfig(null, epoch))
        .finally(() => { window.clearTimeout(timeout); pending = null; });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    // Include request timeout in the refresh bound: a disable/error stops an
    // active public page within a minute while browser timers are running.
    const interval = window.setInterval(refresh, 45_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      pending?.abort();
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [publicPage, permitted]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== MEASUREMENT_CONSENT_KEY && event.key !== EMAIL_ATTRIBUTION_STORAGE_KEY) return;
      const choice = storedConsent();
      emailContext.current.consent = choice;
      email.current?.setContext(emailContext.current);
      if (event.key === EMAIL_ATTRIBUTION_STORAGE_KEY && choice === 'accepted') email.current?.storageChanged();
      controller.current?.setConsent(choice);
      setConsent(choice);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const choose = (choice: Exclude<MeasurementConsent, null>) => {
    // Stop collection synchronously on withdrawal, before a React rerender.
    emailContext.current.consent = choice;
    email.current?.setContext(emailContext.current);
    controller.current?.setConsent(choice);
    try { saveMeasurementConsent(window.localStorage, choice); } catch { /* Storage may be unavailable. */ }
    setConsent(choice);
    setPreferencesOpen(false);
  };

  if (!publicPage || !permitted || !config?.analyticsEnabled || !config.measurementId) return null;
  if (consent && !preferencesOpen) return (
    <button type="button" onClick={() => setPreferencesOpen(true)} data-testid="analytics-preferences"
      className="fixed bottom-3 start-3 z-40 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
      {copy.preferences}
    </button>
  );
  return (
    <section aria-labelledby="analytics-consent-title" data-testid="analytics-consent-banner"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-lg sm:p-5">
      <h2 id="analytics-consent-title" className="text-base font-semibold text-[#143591]">{copy.consentTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy.consentBody}</p>
      <a href="https://www.findandstudy.com/privacy-policy/" target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-[#143591] underline underline-offset-4">{copy.privacy}</a>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => choose('accepted')} data-testid="analytics-accept"
          className="min-h-11 rounded-lg border border-[#143591] bg-white px-4 py-2 text-sm font-medium text-[#143591] hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{copy.accept}</button>
        <button type="button" onClick={() => choose('declined')} data-testid="analytics-decline"
          className="min-h-11 rounded-lg border border-[#143591] bg-white px-4 py-2 text-sm font-medium text-[#143591] hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{copy.decline}</button>
      </div>
    </section>
  );
}
