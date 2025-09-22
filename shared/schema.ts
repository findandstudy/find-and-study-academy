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
  agencyId: varchar("agency_id"),
  profilePicture: text("profile_picture"), // URL to profile picture
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
  country: text("country").notNull(),
  city: text("city").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  status: text("status").notNull().default('pending'), // 'active' | 'inactive' | 'pending'
  description: text("description"),
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
  content: text("content"), // Main content body (HTML, markdown, etc.)
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

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertPaymentConfigSchema = createInsertSchema(paymentConfigs).omit({
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
