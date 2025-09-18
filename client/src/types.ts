export type Role = 'admin' | 'agent';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  agencyId?: string;
  password?: string; // Only for storage
}

export interface Agency {
  id: string;
  name: string;
  logoUrl?: string;
  address?: string;
  lat?: number;
  lng?: number;
  staffSize?: number;
  annualStudents?: number;
  website?: string;
  phone?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  sections: Section[];
}

export interface Section {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  html: string;
  quizId?: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  passPercent: number;
  isFinal?: boolean;
}

export type Question = MCQ | BooleanQ;

export interface MCQ {
  id: string;
  type: 'mcq';
  text: string;
  options: string[];
  answerIndex: number;
}

export interface BooleanQ {
  id: string;
  type: 'boolean';
  text: string;
  answer: boolean;
}

export interface Progress {
  userId: string;
  courseId: string;
  percent: number;
  lessonCompletedIds: string[];
}

export interface Attempt {
  id: string;
  userId: string;
  quizId: string;
  scorePercent: number;
  correct: number;
  incorrect: number;
  date: string;
}

export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  scorePercent: number;
  code: string;
  issuedAt: string;
}

export type PaymentProvider = 'none' | 'stripe' | 'iyzico' | 'paytr' | 'paypal';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

export interface Order {
  id: string;
  userId: string;
  courseId?: string;
  title: string;
  currency: 'USD' | 'EUR' | 'TRY';
  amount: number;
  status: PaymentStatus;
  provider: PaymentProvider;
  paymentIntentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationConfig {
  id: string;
  name: 'Generic Webhook' | 'n8n' | 'Kommo' | 'Google Sheets' | 'SMTP Mail' | 'Custom API';
  enabled: boolean;
  endpointUrl?: string;
  apiKey?: string;
  webhookSecret?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail?: string;
  sheetId?: string;
  tabName?: string;
  kommoDomain?: string;
  kommoToken?: string;
  n8nWorkflowId?: string;
  lastTestAt?: string;
  lastTestStatus?: 'ok' | 'fail';
}

export interface PaymentConfig {
  enabled: boolean;
  provider: PaymentProvider;
  publicKey?: string;
  secretKey?: string;
  successUrl?: string;
  cancelUrl?: string;
  webhookSecret?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  active: boolean;
  createdAt: string;
}

export interface SubscriptionPreferences {
  enrolled: boolean;
  fiftyPercent: boolean;
  seventyFivePercent: boolean;
  completed: boolean;
}