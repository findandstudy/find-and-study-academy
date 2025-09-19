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

export const insertCertificateSchema = createInsertSchema(certificates);
export const insertCourseSchema = createInsertSchema(courses);
export const insertAttemptSchema = createInsertSchema(attempts);
export const insertQuizSchema = createInsertSchema(quizzes);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertAttempt = z.infer<typeof insertAttemptSchema>;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
