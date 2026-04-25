import { create } from 'zustand';
import type { User, Role } from '../types';
import { login as authLogin, signupAgent as authSignup, logout as authLogout, getSession, validateSession, SignupData, LoginCredentials, Session, SignupResult } from '../lib/auth';
import { storage } from '../lib/storage';
import i18n from '../i18n';
import { isSupportedLanguage } from '../i18n/languages';

/** Sync the active i18n language with the user's saved preference, if any. */
function syncLanguageFromUser(user: User | null) {
  if (!user) return;
  const pref = user.languagePreference;
  if (pref && isSupportedLanguage(pref) && i18n.language !== pref) {
    i18n.changeLanguage(pref).catch(() => { /* non-fatal */ });
  }
}

interface AuthState {
  user: User | null;
  role: Role | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  signup: (data: SignupData) => Promise<SignupResult | null>;
  logout: () => void;
  initialize: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isLoading: false,

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true });
    try {
      const session = await authLogin(credentials);
      if (session) {
        // Reset per-login popup tracking so 'every_login' popups re-show this login
        try { sessionStorage.removeItem('fas_popups_seen_login'); } catch {}
        syncLanguageFromUser(session.user);
        set({ user: session.user, role: session.role, isLoading: false });
        return true;
      }
      set({ isLoading: false });
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      set({ isLoading: false });
      return false;
    }
  },

  signup: async (data: SignupData) => {
    set({ isLoading: true });
    try {
      const result = await authSignup(data);
      // Closed system: signup never logs the user in. Account is pending admin/staff approval.
      set({ isLoading: false });
      return result;
    } catch (error) {
      console.error('Signup failed:', error);
      set({ isLoading: false });
      return null;
    }
  },

  logout: () => {
    authLogout();
    try {
      sessionStorage.removeItem('fas_popups_seen_login');
      sessionStorage.removeItem('fas_popups_seen_session');
    } catch {}
    set({ user: null, role: null });
  },

  initialize: async () => {
    const session = getSession();
    if (session) {
      // Validate session against backend; this also refreshes server-side
      // fields (e.g. languagePreference) into the cached session.
      const isValid = await validateSession();
      if (isValid) {
        // Re-read session AFTER validateSession so we pick up rehydrated
        // fields rather than the stale local copy captured above.
        const fresh = getSession() ?? session;
        syncLanguageFromUser(fresh.user);
        set({ user: fresh.user, role: fresh.role });
      } else {
        // Session was invalid and cleared by validateSession
        set({ user: null, role: null });
      }
    }
  },

  updateUser: (updates: Partial<User>) => {
    set((state) => {
      if (!state.user) return state;
      
      const updatedUser = { ...state.user, ...updates };
      
      // Persist updated user to session/localStorage
      const session: Session = { user: updatedUser, role: state.role || updatedUser.role };
      storage.setSession(session);
      
      return { user: updatedUser };
    });
  }
}));