import { create } from 'zustand';
import type { 
  User, 
  Agency, 
  Course, 
  Quiz, 
  Progress, 
  Attempt, 
  Certificate, 
  Order, 
  IntegrationConfig, 
  PaymentConfig,
  Announcement,
  SubscriptionPreferences
} from '../types';
import { storage } from '../lib/storage';

interface DataState {
  // Data
  users: User[];
  agencies: Agency[];
  courses: Course[];
  quizzes: Quiz[];
  progresses: Progress[];
  attempts: Attempt[];
  certificates: Certificate[];
  orders: Order[];
  integrations: IntegrationConfig[];
  paymentConfig: PaymentConfig;
  announcements: Announcement[];
  subscriptionPreferences: SubscriptionPreferences;

  // Actions
  initialize: () => void;
  
  // Users
  addUser: (user: User) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;
  
  // Agencies
  updateAgency: (agencyId: string, updates: Partial<Agency>) => void;
  
  // Progress
  updateProgress: (progress: Progress) => void;
  
  // Attempts
  addAttempt: (attempt: Attempt) => void;
  
  // Certificates
  addCertificate: (certificate: Certificate) => void;
  
  // Integrations
  updateIntegration: (integrationId: string, updates: Partial<IntegrationConfig>) => void;
  
  // Payment Config
  updatePaymentConfig: (config: PaymentConfig) => void;
  
  // Announcements
  addAnnouncement: (announcement: Announcement) => void;
  
  // Subscriptions
  updateSubscriptionPreferences: (preferences: SubscriptionPreferences) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  users: [],
  agencies: [],
  courses: [],
  quizzes: [],
  progresses: [],
  attempts: [],
  certificates: [],
  orders: [],
  integrations: [],
  paymentConfig: { enabled: false, provider: 'none' },
  announcements: [],
  subscriptionPreferences: { enrolled: true, fiftyPercent: true, seventyFivePercent: true, completed: true },

  initialize: () => {
    set({
      users: storage.getUsers(),
      agencies: storage.getAgencies(),
      courses: storage.getCourses(),
      quizzes: storage.getQuizzes(),
      progresses: storage.getProgress(),
      attempts: storage.getAttempts(),
      certificates: storage.getCertificates(),
      orders: storage.getOrders(),
      integrations: storage.getIntegrations(),
      paymentConfig: storage.getPaymentConfig(),
      announcements: storage.getAnnouncements(),
      subscriptionPreferences: storage.getSubscriptionPreferences()
    });
  },

  addUser: (user: User) => {
    storage.addUser(user);
    set({ users: storage.getUsers() });
  },

  updateUser: (userId: string, updates: Partial<User>) => {
    storage.updateUser(userId, updates);
    set({ users: storage.getUsers() });
  },

  updateAgency: (agencyId: string, updates: Partial<Agency>) => {
    storage.updateAgency(agencyId, updates);
    set({ agencies: storage.getAgencies() });
  },

  updateProgress: (progress: Progress) => {
    storage.setProgress(progress);
    set({ progresses: storage.getProgress() });
  },

  addAttempt: (attempt: Attempt) => {
    storage.addAttempt(attempt);
    set({ attempts: storage.getAttempts() });
  },

  addCertificate: (certificate: Certificate) => {
    storage.addCertificate(certificate);
    set({ certificates: storage.getCertificates() });
  },

  updateIntegration: (integrationId: string, updates: Partial<IntegrationConfig>) => {
    storage.updateIntegration(integrationId, updates);
    set({ integrations: storage.getIntegrations() });
  },

  updatePaymentConfig: (config: PaymentConfig) => {
    storage.setPaymentConfig(config);
    set({ paymentConfig: config });
  },

  addAnnouncement: (announcement: Announcement) => {
    storage.addAnnouncement(announcement);
    set({ announcements: storage.getAnnouncements() });
  },

  updateSubscriptionPreferences: (preferences: SubscriptionPreferences) => {
    storage.setSubscriptionPreferences(preferences);
    set({ subscriptionPreferences: preferences });
  }
}));