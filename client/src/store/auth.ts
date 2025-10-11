import { create } from 'zustand';
import type { User, Role } from '../types';
import { login as authLogin, signupAgent as authSignup, logout as authLogout, getSession, SignupData, LoginCredentials, Session } from '../lib/auth';
import { storage } from '../lib/storage';

interface AuthState {
  user: User | null;
  role: Role | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  signup: (data: SignupData) => Promise<boolean>;
  logout: () => void;
  initialize: () => void;
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
      const session = await authSignup(data);
      set({ user: session.user, role: session.role, isLoading: false });
      return true;
    } catch (error) {
      console.error('Signup failed:', error);
      set({ isLoading: false });
      return false;
    }
  },

  logout: () => {
    authLogout();
    set({ user: null, role: null });
  },

  initialize: () => {
    const session = getSession();
    if (session) {
      set({ user: session.user, role: session.role });
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