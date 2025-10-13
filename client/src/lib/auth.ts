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
  const users = storage.getUsers();
  const user = users.find(u => u.email === credentials.email && u.password === credentials.password);
  
  if (!user) {
    return null;
  }

  const session: Session = { user, role: user.role };
  storage.setSession(session);
  return session;
};

export const signupAgent = async (data: SignupData): Promise<Session> => {
  const userId = `agent-${Date.now()}`;
  const agencyId = `agency-${Date.now()}`;
  
  // Create agency
  const newAgency = {
    id: agencyId,
    name: data.agencyName,
    primaryContactName: data.name,
    primaryContactEmail: data.email
  };
  
  // Create user
  const newUser: User = {
    id: userId,
    name: data.name,
    email: data.email,
    role: 'agent' as Role,
    agencyId,
    password: data.password
  };

  storage.addAgency(newAgency);
  storage.addUser(newUser);
  
  const session: Session = { user: newUser, role: newUser.role };
  storage.setSession(session);
  return session;
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