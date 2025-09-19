import { 
  users, 
  certificates, 
  courses, 
  attempts,
  quizzes,
  agencies,
  type User, 
  type InsertUser,
  type Certificate,
  type Course,
  type Attempt,
  type Quiz,
  type Agency,
  type InsertAgency,
  type InsertCertificate
} from "@shared/schema";
import { db } from "./db";
import { eq, count } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
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
  
  // Agency methods
  getAgencies(): Promise<Array<Agency & { agentCount: number }>>;
  createAgency(agency: InsertAgency): Promise<Agency>;
  updateAgency(id: string, updates: Partial<InsertAgency>): Promise<Agency>;
  deleteAgency(id: string): Promise<void>;
  getAgencyById(id: string): Promise<Agency | undefined>;
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

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
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

  // Agency methods
  async getAgencies(): Promise<Array<Agency & { agentCount: number }>> {
    // Get all agencies first
    const allAgencies = await db.select().from(agencies);
    
    // Calculate agent count for each agency
    const agenciesWithCount = await Promise.all(
      allAgencies.map(async (agency) => {
        const [agentCountResult] = await db
          .select({ count: count() })
          .from(users)
          .where(eq(users.agencyId, agency.id));
        
        return {
          ...agency,
          agentCount: agentCountResult?.count || 0
        };
      })
    );
    
    return agenciesWithCount;
  }

  async createAgency(insertAgency: InsertAgency): Promise<Agency> {
    const [agency] = await db
      .insert(agencies)
      .values(insertAgency)
      .returning();
    return agency;
  }

  async updateAgency(id: string, updates: Partial<InsertAgency>): Promise<Agency> {
    const [agency] = await db
      .update(agencies)
      .set(updates)
      .where(eq(agencies.id, id))
      .returning();
    return agency;
  }

  async deleteAgency(id: string): Promise<void> {
    await db.delete(agencies).where(eq(agencies.id, id));
  }

  async getAgencyById(id: string): Promise<Agency | undefined> {
    const [agency] = await db
      .select()
      .from(agencies)
      .where(eq(agencies.id, id));
    return agency || undefined;
  }
}

export const storage = new DatabaseStorage();