import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default('agent'), // 'admin' | 'agent'
  status: text("status").notNull().default('active'), // 'active' | 'inactive'
  agencyId: varchar("agency_id"),
  profilePicture: text("profile_picture"), // URL to profile picture
  emailNotifications: boolean("email_notifications").notNull().default(true), // Email notification preference
  courseCompletionNotif: boolean("course_completion_notif").notNull().default(true),
  certificateNotif: boolean("certificate_notif").notNull().default(true),
  announcementNotif: boolean("announcement_notif").notNull().default(true),
});

// Certificates table for secure server-side verification
export const certificates = pgTable("certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  courseId: varchar("course_id").notNull(),
  scorePercent: integer("score_percent").notNull(),
  code: varchar("code").notNull().unique(), // FAS-XXXXXX format
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
});

// Agencies table  
export const agencies = pgTable("agencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logoUrl: text("logo_url"), // Agency logo URL from Object Storage
  
  // Admin fields (legacy - keep for backward compatibility)
  country: text("country"),
  city: text("city"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  status: text("status").notNull().default('pending'), // 'active' | 'inactive' | 'pending'
  description: text("description"),
  
  // Agent self-service fields
  address: text("address"),
  googleMapUrl: text("google_map_url"),
  yandexMapUrl: text("yandex_map_url"),
  staffSize: integer("staff_size"),
  annualStudents: integer("annual_students"),
  website: text("website"),
  phone: text("phone"),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Countries table for supported countries
export const countries = pgTable("countries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: varchar("code", { length: 2 }).notNull().unique(), // TR, US, etc.
  flag: text("flag"), // Flag emoji or icon URL
  status: text("status").notNull().default('active'), // 'active' | 'inactive'
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Content (lessons/materials) table
export const contents = pgTable("contents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  type: text("type").notNull().default('lesson'), // 'lesson' | 'video' | 'document' | 'quiz'
  countryId: varchar("country_id"), // Optional - content can be country-specific
  courseId: varchar("course_id"), // Link to courses if needed
  quizId: varchar("quiz_id"), // Optional - link to quiz if this content has an embedded quiz
  content: text("content"), // Main content body (HTML, markdown, etc.)
  videoUrl: text("video_url"), // YouTube, Vimeo, or Object Storage video URL
  videoDuration: integer("video_duration"), // Video duration in seconds
  section: text("section"), // Section/category name (e.g., "A1 Destination Countries", "A2 Advanced Level")
  status: text("status").notNull().default('draft'), // 'draft' | 'published' | 'archived'
  order: integer("order").default(0), // For sorting content within a course/country
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Courses table
export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
});

// Quizzes table (for server-side quiz-course validation)
export const quizzes = pgTable("quizzes", {
  id: varchar("id").primaryKey(),
  title: text("title").notNull(),
  courseId: varchar("course_id").notNull(),
  countryId: varchar("country_id"), // Optional - for final exams, specifies which country the quiz is for
  isFinal: boolean("is_final").notNull().default(false),
  passPercent: integer("pass_percent").notNull().default(70),
  questions: text("questions"), // JSON string of questions array (nullable for now)
  description: text("description"),
  status: text("status").notNull().default('active'), // 'active' | 'inactive' | 'draft'
  order: integer("order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Quiz attempts for progress tracking
export const attempts = pgTable("attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  quizId: varchar("quiz_id").notNull(),
  scorePercent: integer("score_percent").notNull(),
  correct: integer("correct").notNull(),
  incorrect: integer("incorrect").notNull(),
  date: timestamp("date").notNull().defaultNow(),
});

// Announcements table
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default('info'), // 'info' | 'warning' | 'success' | 'error'
  priority: text("priority").notNull().default('medium'), // 'low' | 'medium' | 'high' | 'urgent'
  targetAudience: text("target_audience").notNull().default('all'), // 'all' | 'admins' | 'agents'
  status: text("status").notNull().default('draft'), // 'draft' | 'published' | 'archived'
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by").notNull(), // userId of creator
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Email logs table for tracking sent emails
export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  templateType: text("template_type").notNull(), // 'course_completion' | 'certificate' | 'announcement' | 'welcome'
  status: text("status").notNull().default('pending'), // 'pending' | 'sent' | 'failed' | 'bounced'
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Analytics metrics table for tracking user progress and engagement
export const analyticsMetrics = pgTable("analytics_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  metricType: text("metric_type").notNull(), // 'course_start' | 'course_complete' | 'quiz_attempt' | 'lesson_view' | 'login'
  metricValue: text("metric_value"), // JSON data for additional context
  courseId: varchar("course_id"),
  contentId: varchar("content_id"),
  quizId: varchar("quiz_id"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
});

export const insertAgencySchema = createInsertSchema(agencies).omit({
  id: true,
  createdAt: true,
});

export const insertCountrySchema = createInsertSchema(countries).omit({
  id: true,
  createdAt: true,
});

export const insertContentSchema = createInsertSchema(contents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  content: z.string().trim().min(10, 'Content body must be at least 10 characters'),
});

export const insertCertificateSchema = createInsertSchema(certificates);
export const insertCourseSchema = createInsertSchema(courses);
export const insertAttemptSchema = createInsertSchema(attempts);
export const insertQuizSchema = createInsertSchema(quizzes).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAnalyticsMetricSchema = createInsertSchema(analyticsMetrics).omit({
  id: true,
  timestamp: true,
});

// System settings table - stores configuration values
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // Setting identifier (e.g., 'site_name', 'maintenance_mode')
  value: text("value"), // Setting value (stored as JSON string for complex values)
  category: text("category").notNull().default('general'), // 'general' | 'security' | 'notification' | 'appearance'
  type: text("type").notNull().default('string'), // 'string' | 'number' | 'boolean' | 'json'
  description: text("description"), // Human-readable description
  isPublic: boolean("is_public").notNull().default(false), // Whether setting is visible to frontend
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by"), // User ID who last updated
});

// Payment configuration table - stores payment provider settings
export const paymentConfigs = pgTable("payment_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().default('none'), // 'none' | 'stripe' | 'paypal' | 'razorpay'
  enabled: boolean("enabled").notNull().default(false),
  displayName: text("display_name"), // User-friendly provider name
  publicKey: text("public_key"), // Public API key (encrypted)
  secretKey: text("secret_key"), // Secret API key (encrypted) 
  webhookSecret: text("webhook_secret"), // Webhook secret (encrypted)
  successUrl: text("success_url"), // Payment success redirect URL
  cancelUrl: text("cancel_url"), // Payment cancel redirect URL
  settings: text("settings"), // Provider-specific settings (JSON)
  isActive: boolean("is_active").notNull().default(false), // Only one provider can be active
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by"), // User ID who last updated
});

// Integration configurations table for external services
export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Integration name (e.g., 'stripe', 'sendgrid', 'google_sheets')
  type: text("type").notNull(), // Integration category: 'payment' | 'email' | 'storage' | 'crm' | 'analytics' | 'automation'
  enabled: boolean("enabled").notNull().default(false),
  displayName: text("display_name"), // User-friendly name
  description: text("description"), // Description of what this integration does
  
  // Generic API configuration
  endpointUrl: text("endpoint_url"), // API endpoint URL
  apiKey: text("api_key"), // API key (encrypted)
  apiSecret: text("api_secret"), // API secret (encrypted)
  webhookSecret: text("webhook_secret"), // Webhook secret (encrypted)
  
  // Email service configuration (SendGrid, Mailgun, etc.)
  smtpHost: text("smtp_host"),
  smtpPort: text("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"), // SMTP password (encrypted)
  fromEmail: text("from_email"), // Default sender email
  
  // Google Sheets integration
  sheetId: text("sheet_id"), // Google Sheets ID
  tabName: text("tab_name"), // Sheet tab name
  
  // CRM integration (Kommo, HubSpot, etc.)
  crmDomain: text("crm_domain"), // CRM domain/subdomain
  crmToken: text("crm_token"), // CRM access token (encrypted)
  
  // Automation platforms (n8n, Zapier, etc.)
  workflowId: text("workflow_id"), // Workflow/automation ID
  
  // Configuration and status
  settings: text("settings"), // Additional provider-specific settings (JSON)
  lastTestAt: timestamp("last_test_at"), // Last connection test timestamp
  lastTestStatus: text("last_test_status"), // 'success' | 'failed' | 'pending' | 'not_tested'
  lastTestMessage: text("last_test_message"), // Test result message
  
  // Audit fields
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: varchar("created_by"), // User ID who created
  updatedBy: varchar("updated_by"), // User ID who last updated
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertPaymentConfigSchema = createInsertSchema(paymentConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Agency = typeof agencies.$inferSelect;
export type Country = typeof countries.$inferSelect;
export type Content = typeof contents.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type PaymentConfig = typeof paymentConfigs.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type InsertAgency = z.infer<typeof insertAgencySchema>;
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type InsertContent = z.infer<typeof insertContentSchema>;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertAttempt = z.infer<typeof insertAttemptSchema>;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type InsertPaymentConfig = z.infer<typeof insertPaymentConfigSchema>;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type AnalyticsMetric = typeof analyticsMetrics.$inferSelect;
export type InsertAnalyticsMetric = z.infer<typeof insertAnalyticsMetricSchema>;

// Frontend question types (matches client-side form)
export const frontendQuestionSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('boolean'),
    text: z.string().min(1, 'Question text is required'),
    answer: z.boolean()
  }),
  z.object({
    id: z.string(),
    type: z.literal('mcq'),
    text: z.string().min(1, 'Question text is required'),
    options: z.array(z.string().min(1, 'Option text required')).min(2).max(6),
    answerIndex: z.number().min(0)
  })
]);

export type FrontendQuestion = z.infer<typeof frontendQuestionSchema>;

// Frontend Quiz DTO (questions as parsed array)  
export type QuizDTO = Omit<Quiz, 'questions'> & {
  questions: FrontendQuestion[];
};

// Frontend Insert Quiz DTO  
export type InsertQuizDTO = Omit<InsertQuiz, 'questions'> & {
  questions: FrontendQuestion[];
};
