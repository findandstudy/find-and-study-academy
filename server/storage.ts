import { 
  users, 
  certificates, 
  courses, 
  attempts,
  quizzes,
  type User, 
  type InsertUser,
  type Certificate,
  type Course,
  type Attempt,
  type Quiz,
  type InsertCertificate
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Certificate methods for server-side verification
  getCertificates(): Promise<Certificate[]>;
  addCertificate(certificate: InsertCertificate): Promise<Certificate>;
  getCertificateByCode(code: string): Promise<Certificate | undefined>;
  
  // Course methods
  getCourses(): Promise<Course[]>;
  
  // User methods for verification
  getUsers(): Promise<User[]>;
  
  // Attempt methods
  addAttempt(attempt: Attempt): Promise<Attempt>;
  getAttempts(): Promise<Attempt[]>;
  
  // Quiz methods for validation
  getQuizById(quizId: string): Promise<Quiz | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Certificate methods for server-side verification
  async getCertificates(): Promise<Certificate[]> {
    return await db.select().from(certificates);
  }

  async addCertificate(certificate: InsertCertificate): Promise<Certificate> {
    const [newCertificate] = await db
      .insert(certificates)
      .values(certificate)
      .returning();
    return newCertificate;
  }

  async getCertificateByCode(code: string): Promise<Certificate | undefined> {
    const [certificate] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.code, code));
    return certificate || undefined;
  }

  // Course methods
  async getCourses(): Promise<Course[]> {
    return await db.select().from(courses);
  }

  // User methods for verification
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Attempt methods
  async addAttempt(attempt: Attempt): Promise<Attempt> {
    const [newAttempt] = await db
      .insert(attempts)
      .values(attempt)
      .returning();
    return newAttempt;
  }

  async getAttempts(): Promise<Attempt[]> {
    return await db.select().from(attempts);
  }

  // Quiz methods for validation
  async getQuizById(quizId: string): Promise<Quiz | undefined> {
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId));
    return quiz || undefined;
  }
}

export const storage = new DatabaseStorage();