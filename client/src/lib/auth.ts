import type { User, Role } from '../types';
import { storage } from './storage';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  agencyName: string;
  country: string;
}

export interface Session {
  user: User;
  role: Role;
}

export const login = async (credentials: LoginCredentials): Promise<Session | null> => {
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
    if (data.success && data.user) {
      const session: Session = { user: data.user, role: data.user.role };
      storage.setSession(session);
      return session;
    }

    return null;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
};

export const signupAgent = async (data: SignupData): Promise<Session> => {
  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        password: data.password,
        agencyName: data.agencyName
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Signup failed');
    }

    const result = await response.json();
    if (result.success && result.user) {
      const session: Session = { user: result.user, role: result.user.role };
      storage.setSession(session);
      
      // Add agency to localStorage if returned from backend
      if (result.agency) {
        storage.addAgency(result.agency);
      }
      
      return session;
    }

    throw new Error('Signup failed');
  } catch (error) {
    console.error('Signup error:', error);
    throw error;
  }
};

export const getSession = (): Session | null => {
  return storage.getSession();
};

export const logout = (): void => {
  storage.clearSession();
};

export const currentUser = (): { user: User; role: Role } | null => {
  const session = getSession();
  return session ? { user: session.user, role: session.role } : null;
};

// Validate session against backend - returns true if valid, false if invalid
export const validateSession = async (): Promise<boolean> => {
  const session = getSession();
  if (!session) return false;

  try {
    const response = await fetch('/api/me', {
      method: 'GET',
      headers: {
        'x-user-id': session.user.id,
        'x-user-role': session.user.role,
      },
    });

    if (!response.ok) {
      // Session is invalid (401 or other error) - clear it
      console.log('[SESSION VALIDATION] Invalid session, logging out');
      logout();
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SESSION VALIDATION] Error:', error);
    // On error, assume session is invalid
    logout();
    return false;
  }
};