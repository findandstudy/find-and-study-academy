import type { User, Role } from '../types';
import { storage } from './storage';
import { allowedSignupAttributionToken, emailAttributionClient, recordSuccessfulSignup } from './email-attribution';

// Every explicit authentication change invalidates older async results before
// they can repopulate (or clear) the browser's session cache.
let authRevision = 0;
let logoutRequest: Promise<boolean> | null = null;
const pendingAuthWrites = new Set<Promise<unknown>>();
export const getAuthRevision = () => authRevision;
export const isLogoutInProgress = () => logoutRequest !== null;
const currentRevision = (revision: number) => revision === authRevision && !isLogoutInProgress();
async function trackAuthWrite<T>(request: () => Promise<T>): Promise<T> {
  const pending = request();
  pendingAuthWrites.add(pending);
  try { return await pending; } finally { pendingAuthWrites.delete(pending); }
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  emailAttributionToken?: string;
  promoCode?: string;
  verificationCode?: string;
  name: string;
  email: string;
  password: string;
  agencyName: string;
  country: string;
  phone: string;
  languagePreference?: string;
}

export interface Session {
  user: User;
  role: Role;
}

export const login = async (credentials: LoginCredentials): Promise<Session | null> => {
  if (isLogoutInProgress()) return null;
  const revision = ++authRevision;
  return trackAuthWrite(async () => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.success && data.user && currentRevision(revision)) {
        const session: Session = { user: data.user, role: data.user.role };
        storage.setSession(session);
        return session;
      }

      return null;
    } catch (error) {
      if (!currentRevision(revision)) return null;
      console.error('Login error:', error);
      return null;
    }
  });
};

export interface SignupResult {
  pending: boolean;
  message?: string;
  session?: Session;
  error?: boolean;
}

export const signupAgent = async (data: SignupData): Promise<SignupResult> => {
  if (isLogoutInProgress()) return { pending: false, error: true, message: 'Request failed' };
  const revision = ++authRevision;
  return trackAuthWrite(async () => {
    try {
      // The store has already entered its submitting state. Wait briefly for
      // a receipt without leaving the form enabled for duplicate submissions.
      const attributionToken = typeof window === 'undefined' ? undefined : await emailAttributionClient(window).registrationToken();
      if (!currentRevision(revision)) return { pending: false, error: true, message: 'Request failed' };
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailAttributionToken: allowedSignupAttributionToken(data.emailAttributionToken || attributionToken),
          promoCode: data.promoCode,
          verificationCode: data.verificationCode,
          name: data.name,
          email: data.email,
          password: data.password,
          agencyName: data.agencyName,
          country: data.country,
          phone: data.phone,
          languagePreference: data.languagePreference,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Signup failed');
      }

      const result = await response.json();
      if (!currentRevision(revision)) return { pending: false, error: true, message: 'Request failed' };
      if (result.success === true) {
        if (result.pending === true) {
          recordSuccessfulSignup(data.promoCode ? 'promo' : 'standard');
          return { pending: true, message: result.message };
        }
        if (result.user?.role === 'agent') {
          recordSuccessfulSignup(data.promoCode ? 'promo' : 'standard');
          const session: Session = { user: result.user, role: 'agent' };
          storage.setSession(session);
          return { pending: false, message: result.message, session };
        }
      }

      throw new Error(result.message || 'Signup failed');
    } catch (error) {
      if (!currentRevision(revision)) return { pending: false, error: true, message: 'Request failed' };
      console.error('Signup error:', error);
      throw error;
    }
  });
};

export const getSession = (): Session | null => {
  return storage.getSession();
};

// Cache invalidation is deliberately separate from explicit server logout:
// validation failure must never revoke an SSO/server session as a side effect.
export const clearSessionCache = (): void => {
  try { storage.clearSession(); } catch { /* Server session remains authoritative. */ }
};

export const logout = (): Promise<boolean> => {
  if (logoutRequest) return logoutRequest;
  authRevision++;
  const earlierWrites = Array.from(pendingAuthWrites);
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { abort.abort(); reject(new Error('Logout timed out')); }, 10_000);
  });
  const operation = (async () => {
    try {
      // A late login Set-Cookie must arrive before the revocation request. If
      // it hangs, the ten-second deadline fails without claiming a logout.
      await Promise.race([Promise.allSettled(earlierWrites), deadline]);
      const response = await Promise.race([fetch('/api/logout', {
        method: 'POST', credentials: 'include', headers: { Accept: 'application/json' }, signal: abort.signal,
      }), deadline]);
      if (!response.ok) return false;
      const result = await Promise.race([response.json(), deadline]);
      if (result?.success !== true) return false;
      clearSessionCache();
      return true;
    } catch { return false; }
    finally { clearTimeout(timer!); }
  })();
  logoutRequest = operation;
  void operation.then(() => { if (logoutRequest === operation) logoutRequest = null; });
  return operation;
};

export const currentUser = (): { user: User; role: Role } | null => {
  const session = getSession();
  return session ? { user: session.user, role: session.role } : null;
};

// Hydrate the browser state from the authoritative server-side session.
// This must work even when localStorage is empty: SSO establishes the secure
// session cookie on the server and intentionally cannot write localStorage.
export const fetchServerSession = async (): Promise<Session | null> => {
  if (isLogoutInProgress()) return null;
  const revision = authRevision;
  try {
    const response = await fetch('/api/me', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!currentRevision(revision) || !data?.success || !data.user?.id || !data.user?.role) {
      return null;
    }

    const cached = getSession();
    const cachedUser = cached?.user;
    const session: Session = {
      user: cachedUser?.id === data.user.id
        ? { ...cachedUser, ...data.user }
        : data.user,
      role: data.user.role,
    };
    storage.setSession(session);
    return session;
  } catch (error) {
    if (!currentRevision(revision)) return null;
    console.error('[SESSION VALIDATION] Error:', error);
    return null;
  }
};

// Validate and re-hydrate the browser state from the server session. A missing
// or invalid server session clears stale local state.
export const validateSession = async (): Promise<boolean> => {
  if (isLogoutInProgress()) return false;
  const revision = authRevision;
  const session = await fetchServerSession();
  if (!currentRevision(revision)) return false;
  if (session) return true;

  clearSessionCache();
  return false;
};

