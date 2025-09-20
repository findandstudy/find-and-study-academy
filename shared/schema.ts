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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Agency = typeof agencies.$inferSelect;
export type Country = typeof countries.$inferSelect;
export type Content = typeof contents.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type InsertAgency = z.infer<typeof insertAgencySchema>;
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type InsertContent = z.infer<typeof insertContentSchema>;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertAttempt = z.infer<typeof insertAttemptSchema>;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;

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
