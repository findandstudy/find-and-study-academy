import { legacyUi, legacyMessage } from "@/lib/legacy-ui";
import { create } from 'zustand';
import type { User, Role } from '../types';
import { login as authLogin, signupAgent as authSignup, logout as authLogout, getSession, getAuthRevision, isLogoutInProgress, validateSession, SignupData, LoginCredentials, Session, SignupResult } from '../lib/auth';
import { storage } from '../lib/storage';
import i18n from '../i18n';
import { isSupportedLanguage } from '../i18n/languages';
import { toast } from '../hooks/use-toast';

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
  logout: () => Promise<boolean>;
  initialize: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  // Route guards must wait for the authoritative server session. This is
  // especially important after SSO, where localStorage starts empty.
  isLoading: true,

  login: async (credentials: LoginCredentials) => {
    if (isLogoutInProgress()) return false;
    set({ isLoading: true });
    const request = authLogin(credentials);
    const revision = getAuthRevision();
    try {
      const session = await request;
      if (revision !== getAuthRevision() || isLogoutInProgress()) return false;
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
      if (revision !== getAuthRevision() || isLogoutInProgress()) return false;
      console.error('Login failed:', error);
      set({ isLoading: false });
      return false;
    }
  },

  signup: async (data: SignupData) => {
    if (isLogoutInProgress()) return { pending: false, error: true, message: legacyUi('Request failed') };
    set({ isLoading: true });
    const request = authSignup(data);
    const revision = getAuthRevision();
    try {
      const result = await request;
      if (revision !== getAuthRevision() || isLogoutInProgress()) return null;
      if (result.session) {
        syncLanguageFromUser(result.session.user);
        set({ user: result.session.user, role: result.session.role, isLoading: false });
        return result;
      }
      set({ isLoading: false });
      return result;
    } catch (error) {
      if (revision !== getAuthRevision() || isLogoutInProgress()) return null;
      console.error('Signup failed:', error);
      set({ isLoading: false });
      return { pending: false, error: true, message: error instanceof Error ? legacyMessage(error.message) : legacyUi("Signup failed") };
    }
  },

  logout: async () => {
    set({ isLoading: true });
    const success = await authLogout();
    if (!success) {
      set({ isLoading: false });
      toast({ title: legacyUi('Logout failed'), variant: 'destructive' });
      return false;
    }
    try {
      sessionStorage.removeItem('fas_popups_seen_login');
      sessionStorage.removeItem('fas_popups_seen_session');
    } catch {}
    set({ user: null, role: null, isLoading: false });
    return true;
  },

  initialize: async () => {
    if (isLogoutInProgress()) return;
    const revision = getAuthRevision();
    set({ isLoading: true });

    // Always ask the server. SSO creates a secure server-side session cookie
    // but cannot populate the Academy localStorage cache itself.
    const isValid = await validateSession();
    if (revision !== getAuthRevision() || isLogoutInProgress()) return;
    if (isValid) {
      const fresh = getSession();
      if (fresh) {
        syncLanguageFromUser(fresh.user);
        set({ user: fresh.user, role: fresh.role, isLoading: false });
        return;
      }
    }

    set({ user: null, role: null, isLoading: false });
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
