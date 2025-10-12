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
import { Session } from './auth';
import {
  SEED_USERS,
  SEED_AGENCIES,
  SEED_COURSES,
  SEED_QUIZZES,
  SEED_ORDERS,
  SEED_INTEGRATIONS,
  SEED_PAYMENT_CONFIG,
  SEED_ANNOUNCEMENTS,
  DEFAULT_SUBSCRIPTION_PREFERENCES
} from '../data/seed';

const STORAGE_KEYS = {
  USERS: 'fas_users',
  AGENCIES: 'fas_agencies',
  COURSES: 'fas_courses',
  QUIZZES: 'fas_quizzes',
  PROGRESS: 'fas_progress',
  ATTEMPTS: 'fas_attempts',
  CERTIFICATES: 'fas_certificates',
  ORDERS: 'fas_orders',
  INTEGRATIONS: 'fas_integrations',
  PAYMENT_CONFIG: 'fas_payment_config',
  ANNOUNCEMENTS: 'fas_announcements',
  SUBSCRIPTIONS: 'fas_subscriptions',
  SESSION: 'fas_session',
  INITIALIZED: 'fas_initialized_v2' // Updated version to force re-initialization
};

class LocalStorage {
  constructor() {
    this.initializeData();
  }

  private initializeData() {
    if (!localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
      localStorage.setItem(STORAGE_KEYS.AGENCIES, JSON.stringify(SEED_AGENCIES));
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(SEED_COURSES));
      localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(SEED_QUIZZES));
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.CERTIFICATES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(SEED_ORDERS));
      localStorage.setItem(STORAGE_KEYS.INTEGRATIONS, JSON.stringify(SEED_INTEGRATIONS));
      localStorage.setItem(STORAGE_KEYS.PAYMENT_CONFIG, JSON.stringify(SEED_PAYMENT_CONFIG));
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(SEED_ANNOUNCEMENTS));
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(DEFAULT_SUBSCRIPTION_PREFERENCES));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  }

  // Generic helpers
  private get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // Users
  getUsers(): User[] {
    return this.get(STORAGE_KEYS.USERS, []);
  }

  addUser(user: User): void {
    const users = this.getUsers();
    users.push(user);
    this.set(STORAGE_KEYS.USERS, users);
  }

  updateUser(userId: string, updates: Partial<User>): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      this.set(STORAGE_KEYS.USERS, users);
    }
  }

  // Agencies
  getAgencies(): Agency[] {
    return this.get(STORAGE_KEYS.AGENCIES, []);
  }

  addAgency(agency: Agency): void {
    const agencies = this.getAgencies();
    agencies.push(agency);
    this.set(STORAGE_KEYS.AGENCIES, agencies);
  }

  updateAgency(agencyId: string, updates: Partial<Agency>): void {
    const agencies = this.getAgencies();
    const index = agencies.findIndex(a => a.id === agencyId);
    if (index !== -1) {
      agencies[index] = { ...agencies[index], ...updates };
      this.set(STORAGE_KEYS.AGENCIES, agencies);
    }
  }

  // Courses
  getCourses(): Course[] {
    return this.get(STORAGE_KEYS.COURSES, []);
  }

  // Quizzes
  getQuizzes(): Quiz[] {
    return this.get(STORAGE_KEYS.QUIZZES, []);
  }

  // Progress
  getProgress(): Progress[] {
    return this.get(STORAGE_KEYS.PROGRESS, []);
  }

  setProgress(progress: Progress): void {
    const allProgress = this.getProgress();
    const index = allProgress.findIndex(p => p.userId === progress.userId && p.courseId === progress.courseId);
    if (index !== -1) {
      allProgress[index] = progress;
    } else {
      allProgress.push(progress);
    }
    this.set(STORAGE_KEYS.PROGRESS, allProgress);
  }

  // Attempts
  getAttempts(): Attempt[] {
    return this.get(STORAGE_KEYS.ATTEMPTS, []);
  }

  addAttempt(attempt: Attempt): void {
    const attempts = this.getAttempts();
    attempts.push(attempt);
    this.set(STORAGE_KEYS.ATTEMPTS, attempts);
  }

  // Certificates
  getCertificates(): Certificate[] {
    return this.get(STORAGE_KEYS.CERTIFICATES, []);
  }

  addCertificate(certificate: Certificate): void {
    const certificates = this.getCertificates();
    certificates.push(certificate);
    this.set(STORAGE_KEYS.CERTIFICATES, certificates);
  }

  // Orders
  getOrders(): Order[] {
    return this.get(STORAGE_KEYS.ORDERS, []);
  }

  // Integrations
  getIntegrations(): IntegrationConfig[] {
    return this.get(STORAGE_KEYS.INTEGRATIONS, []);
  }

  updateIntegration(integrationId: string, updates: Partial<IntegrationConfig>): void {
    const integrations = this.getIntegrations();
    const index = integrations.findIndex(i => i.id === integrationId);
    if (index !== -1) {
      integrations[index] = { ...integrations[index], ...updates };
      this.set(STORAGE_KEYS.INTEGRATIONS, integrations);
    }
  }

  // Payment Config
  getPaymentConfig(): PaymentConfig {
    return this.get(STORAGE_KEYS.PAYMENT_CONFIG, SEED_PAYMENT_CONFIG);
  }

  setPaymentConfig(config: PaymentConfig): void {
    this.set(STORAGE_KEYS.PAYMENT_CONFIG, config);
  }

  // Announcements
  getAnnouncements(): Announcement[] {
    return this.get(STORAGE_KEYS.ANNOUNCEMENTS, []);
  }

  addAnnouncement(announcement: Announcement): void {
    const announcements = this.getAnnouncements();
    announcements.push(announcement);
    this.set(STORAGE_KEYS.ANNOUNCEMENTS, announcements);
  }

  // Subscriptions
  getSubscriptionPreferences(): SubscriptionPreferences {
    return this.get(STORAGE_KEYS.SUBSCRIPTIONS, DEFAULT_SUBSCRIPTION_PREFERENCES);
  }

  setSubscriptionPreferences(preferences: SubscriptionPreferences): void {
    this.set(STORAGE_KEYS.SUBSCRIPTIONS, preferences);
  }

  // Session
  getSession(): Session | null {
    return this.get(STORAGE_KEYS.SESSION, null);
  }

  setSession(session: Session): void {
    this.set(STORAGE_KEYS.SESSION, session);
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }
}

export const storage = new LocalStorage();