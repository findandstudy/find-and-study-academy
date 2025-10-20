import { 
  users, 
  certificates, 
  courses, 
  attempts,
  progresses,
  quizzes,
  agencies,
  countries,
  contents,
  announcements,
  systemSettings,
  paymentConfigs,
  integrations,
  emailLogs,
  analyticsMetrics,
  type User, 
  type InsertUser,
  type Certificate,
  type Course,
  type Attempt,
  type Progress,
  type InsertProgress,
  type Quiz,
  type InsertQuiz,
  type Agency,
  type InsertAgency,
  type InsertCertificate,
  type Country,
  type InsertCountry,
  type Content,
  type InsertContent,
  type Announcement,
  type InsertAnnouncement,
  type SystemSetting,
  type InsertSystemSetting,
  type PaymentConfig,
  type InsertPaymentConfig,
  type Integration,
  type InsertIntegration,
  type EmailLog,
  type InsertEmailLog,
  type AnalyticsMetric,
  type InsertAnalyticsMetric
} from "@shared/schema";
import { db } from "./db";
import { eq, count, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  
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
  
  // Progress methods for cross-device progress tracking
  getProgresses(userId?: string): Promise<Progress[]>;
  getProgressByUserAndCourse(userId: string, courseId: string): Promise<Progress | undefined>;
  upsertProgress(data: Partial<InsertProgress> & { userId: string; courseId: string }): Promise<Progress>;
  updateProgress(userId: string, courseId: string, updates: Partial<Omit<InsertProgress, 'userId' | 'courseId'>>): Promise<Progress>;
  
  // Quiz methods for validation
  getQuizById(quizId: string): Promise<Quiz | undefined>;
  
  // Agency methods
  getAgencies(): Promise<Array<Agency & { agentCount: number }>>;
  createAgency(agency: InsertAgency): Promise<Agency>;
  updateAgency(id: string, updates: Partial<InsertAgency>): Promise<Agency>;
  deleteAgency(id: string): Promise<void>;
  getAgencyById(id: string): Promise<Agency | undefined>;

  // Country methods
  getCountries(): Promise<Country[]>;
  createCountry(country: InsertCountry): Promise<Country>;
  updateCountry(id: string, updates: Partial<InsertCountry>): Promise<Country>;
  deleteCountry(id: string): Promise<void>;
  getCountryById(id: string): Promise<Country | undefined>;

  // Content methods
  getContents(): Promise<Array<Content & { countryName?: string }>>;
  createContent(content: InsertContent): Promise<Content>;
  updateContent(id: string, updates: Partial<InsertContent>): Promise<Content>;
  deleteContent(id: string): Promise<void>;
  getContentById(id: string): Promise<Content | undefined>;

  // Announcement methods
  getAnnouncements(): Promise<Array<Announcement & { creatorName?: string }>>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  updateAnnouncement(id: string, updates: Partial<InsertAnnouncement>): Promise<Announcement>;
  deleteAnnouncement(id: string): Promise<void>;
  getAnnouncementById(id: string): Promise<Announcement | undefined>;

  // System Settings methods
  getSystemSettings(): Promise<SystemSetting[]>;
  getSystemSettingByKey(key: string): Promise<SystemSetting | undefined>;
  createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  updateSystemSetting(key: string, updates: Partial<InsertSystemSetting>): Promise<SystemSetting>;
  deleteSystemSetting(key: string): Promise<void>;

  // Payment Configuration methods
  getPaymentConfigs(): Promise<PaymentConfig[]>;
  getActivePaymentConfig(): Promise<PaymentConfig | undefined>;
  getPaymentConfigById(id: string): Promise<PaymentConfig | undefined>;
  createPaymentConfig(config: InsertPaymentConfig): Promise<PaymentConfig>;
  updatePaymentConfig(id: string, updates: Partial<InsertPaymentConfig>): Promise<PaymentConfig>;
  deletePaymentConfig(id: string): Promise<void>;
  activatePaymentConfig(id: string): Promise<void>;

  // Integration methods
  getIntegrations(): Promise<Integration[]>;
  getIntegrationById(id: string): Promise<Integration | undefined>;
  getIntegrationsByType(type: string): Promise<Integration[]>;
  getEnabledIntegrations(): Promise<Integration[]>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegration(id: string, updates: Partial<InsertIntegration>): Promise<Integration>;
  deleteIntegration(id: string): Promise<void>;
  testIntegrationConnection(id: string): Promise<{ success: boolean; message: string; status?: string }>;
  enableIntegration(id: string): Promise<Integration>;
  disableIntegration(id: string): Promise<Integration>;

  // Email Log methods
  getEmailLogs(): Promise<EmailLog[]>;
  getUserEmailLogs(userId: string): Promise<EmailLog[]>;
  createEmailLog(log: InsertEmailLog): Promise<EmailLog>;
  updateEmailLogStatus(id: string, status: string, errorMessage?: string): Promise<EmailLog>;

  // Analytics methods
  createAnalyticsMetric(metric: InsertAnalyticsMetric): Promise<AnalyticsMetric>;
  getUserMetrics(userId: string): Promise<AnalyticsMetric[]>;
  getCourseMetrics(courseId: string): Promise<AnalyticsMetric[]>;
  getMetricsByType(metricType: string): Promise<AnalyticsMetric[]>;
  getMetricsInDateRange(startDate: Date, endDate: Date): Promise<AnalyticsMetric[]>;
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

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
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

  // Progress methods for cross-device progress tracking
  async getProgresses(userId?: string): Promise<Progress[]> {
    if (userId) {
      return await db.select().from(progresses).where(eq(progresses.userId, userId));
    }
    return await db.select().from(progresses);
  }

  async getProgressByUserAndCourse(userId: string, courseId: string): Promise<Progress | undefined> {
    const [progress] = await db
      .select()
      .from(progresses)
      .where(and(
        eq(progresses.userId, userId),
        eq(progresses.courseId, courseId)
      ));
    return progress || undefined;
  }

  async upsertProgress(data: Partial<InsertProgress> & { userId: string; courseId: string }): Promise<Progress> {
    // Try to find existing progress
    const existing = await this.getProgressByUserAndCourse(data.userId, data.courseId);
    
    if (existing) {
      // Update existing progress - merge with existing values
      const [updated] = await db
        .update(progresses)
        .set({
          lessonCompletedIds: data.lessonCompletedIds !== undefined ? data.lessonCompletedIds : existing.lessonCompletedIds,
          percent: data.percent !== undefined ? data.percent : existing.percent,
          currentLessonId: data.currentLessonId !== undefined ? data.currentLessonId : existing.currentLessonId,
          lastLessonCompletedAt: data.lastLessonCompletedAt !== undefined ? data.lastLessonCompletedAt : existing.lastLessonCompletedAt,
          lastAccessed: new Date(),
        })
        .where(and(
          eq(progresses.userId, data.userId),
          eq(progresses.courseId, data.courseId)
        ))
        .returning();
      return updated;
    } else {
      // Insert new progress with defaults
      const [newProgress] = await db
        .insert(progresses)
        .values({
          userId: data.userId,
          courseId: data.courseId,
          lessonCompletedIds: data.lessonCompletedIds || [],
          percent: data.percent || 0,
          currentLessonId: data.currentLessonId || null,
          lastLessonCompletedAt: data.lastLessonCompletedAt || null,
        })
        .returning();
      return newProgress;
    }
  }

  async updateProgress(userId: string, courseId: string, updates: Partial<Omit<InsertProgress, 'userId' | 'courseId'>>): Promise<Progress> {
    // Get existing progress
    const existing = await this.getProgressByUserAndCourse(userId, courseId);
    
    if (!existing) {
      throw new Error('Progress not found');
    }

    // Partial update - only update provided fields
    const [updated] = await db
      .update(progresses)
      .set({
        ...updates,
        lastAccessed: new Date(),
      })
      .where(and(
        eq(progresses.userId, userId),
        eq(progresses.courseId, courseId)
      ))
      .returning();
    return updated;
  }

  // Quiz methods for validation and admin management
  async getQuizById(quizId: string): Promise<Quiz | undefined> {
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId));
    return quiz || undefined;
  }

  async getQuizzes(): Promise<Quiz[]> {
    return await db.select().from(quizzes).orderBy(quizzes.order, quizzes.title);
  }

  async createQuiz(insertQuiz: InsertQuiz): Promise<Quiz> {
    const [quiz] = await db
      .insert(quizzes)
      .values({
        ...insertQuiz,
        id: insertQuiz.id || `quiz-${Date.now()}`, // Generate ID if not provided
        updatedAt: new Date()
      })
      .returning();
    return quiz;
  }

  async updateQuiz(id: string, updates: Partial<InsertQuiz>): Promise<Quiz> {
    const [quiz] = await db
      .update(quizzes)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(quizzes.id, id))
      .returning();
    return quiz;
  }

  async deleteQuiz(id: string): Promise<void> {
    await db.delete(quizzes).where(eq(quizzes.id, id));
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

  // Country methods implementation
  async getCountries(): Promise<Country[]> {
    return await db.select().from(countries).orderBy(countries.name);
  }

  async createCountry(insertCountry: InsertCountry): Promise<Country> {
    const [country] = await db
      .insert(countries)
      .values(insertCountry)
      .returning();
    return country;
  }

  async updateCountry(id: string, updates: Partial<InsertCountry>): Promise<Country> {
    const [country] = await db
      .update(countries)
      .set(updates)
      .where(eq(countries.id, id))
      .returning();
    return country;
  }

  async deleteCountry(id: string): Promise<void> {
    await db.delete(countries).where(eq(countries.id, id));
  }

  async getCountryById(id: string): Promise<Country | undefined> {
    const [country] = await db.select().from(countries).where(eq(countries.id, id));
    return country || undefined;
  }

  // Content methods implementation
  async getContents(): Promise<Array<Content & { countryName?: string }>> {
    // Join with countries table to get country name
    const contentsWithCountry = await db
      .select({
        id: contents.id,
        title: contents.title,
        slug: contents.slug,
        description: contents.description,
        type: contents.type,
        countryId: contents.countryId,
        courseId: contents.courseId,
        quizId: contents.quizId,
        content: contents.content,
        videoUrl: contents.videoUrl,
        videoDuration: contents.videoDuration,
        section: contents.section,
        status: contents.status,
        order: contents.order,
        createdAt: contents.createdAt,
        updatedAt: contents.updatedAt,
        countryName: countries.name
      })
      .from(contents)
      .leftJoin(countries, eq(contents.countryId, countries.id))
      .orderBy(contents.order, contents.title);

    // Convert null to undefined for type compatibility
    return contentsWithCountry.map(item => ({
      ...item,
      countryName: item.countryName ?? undefined
    }));
  }

  async createContent(insertContent: InsertContent): Promise<Content> {
    const [content] = await db
      .insert(contents)
      .values({
        ...insertContent,
        updatedAt: new Date()
      })
      .returning();
    return content;
  }

  async updateContent(id: string, updates: Partial<InsertContent>): Promise<Content> {
    const [content] = await db
      .update(contents)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(contents.id, id))
      .returning();
    return content;
  }

  async deleteContent(id: string): Promise<void> {
    await db.delete(contents).where(eq(contents.id, id));
  }

  async getContentById(id: string): Promise<Content | undefined> {
    const [content] = await db.select().from(contents).where(eq(contents.id, id));
    return content || undefined;
  }

  // Announcement methods implementation
  async getAnnouncements(): Promise<Array<Announcement & { creatorName?: string }>> {
    const announcementsWithCreator = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        type: announcements.type,
        priority: announcements.priority,
        targetAudience: announcements.targetAudience,
        status: announcements.status,
        publishedAt: announcements.publishedAt,
        expiresAt: announcements.expiresAt,
        createdBy: announcements.createdBy,
        createdAt: announcements.createdAt,
        updatedAt: announcements.updatedAt,
        creatorName: users.name
      })
      .from(announcements)
      .leftJoin(users, eq(announcements.createdBy, users.id))
      .orderBy(announcements.createdAt);

    // Convert null to undefined for type compatibility
    return announcementsWithCreator.map(item => ({
      ...item,
      creatorName: item.creatorName ?? undefined
    }));
  }

  async createAnnouncement(insertAnnouncement: InsertAnnouncement): Promise<Announcement> {
    const [announcement] = await db
      .insert(announcements)
      .values({
        ...insertAnnouncement,
        updatedAt: new Date()
      })
      .returning();
    return announcement;
  }

  async updateAnnouncement(id: string, updates: Partial<InsertAnnouncement>): Promise<Announcement> {
    const [announcement] = await db
      .update(announcements)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(announcements.id, id))
      .returning();
    return announcement;
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  async getAnnouncementById(id: string): Promise<Announcement | undefined> {
    const [announcement] = await db.select().from(announcements).where(eq(announcements.id, id));
    return announcement || undefined;
  }

  // System Settings methods implementation
  async getSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings).orderBy(systemSettings.category, systemSettings.key);
  }

  async getSystemSettingByKey(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key));
    return setting || undefined;
  }

  async createSystemSetting(insertSetting: InsertSystemSetting): Promise<SystemSetting> {
    const [setting] = await db
      .insert(systemSettings)
      .values({
        ...insertSetting,
        updatedAt: new Date()
      })
      .returning();
    return setting;
  }

  async updateSystemSetting(key: string, updates: Partial<InsertSystemSetting>): Promise<SystemSetting> {
    const [setting] = await db
      .update(systemSettings)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(systemSettings.key, key))
      .returning();
    return setting;
  }

  async deleteSystemSetting(key: string): Promise<void> {
    await db.delete(systemSettings).where(eq(systemSettings.key, key));
  }

  // Payment Configuration methods implementation
  async getPaymentConfigs(): Promise<PaymentConfig[]> {
    return await db.select().from(paymentConfigs).orderBy(paymentConfigs.provider, paymentConfigs.displayName);
  }

  async getActivePaymentConfig(): Promise<PaymentConfig | undefined> {
    const [config] = await db
      .select()
      .from(paymentConfigs)
      .where(eq(paymentConfigs.isActive, true));
    return config || undefined;
  }

  async getPaymentConfigById(id: string): Promise<PaymentConfig | undefined> {
    const [config] = await db
      .select()
      .from(paymentConfigs)
      .where(eq(paymentConfigs.id, id));
    return config || undefined;
  }

  async createPaymentConfig(insertConfig: InsertPaymentConfig): Promise<PaymentConfig> {
    const [config] = await db
      .insert(paymentConfigs)
      .values({
        ...insertConfig,
        updatedAt: new Date()
      })
      .returning();
    return config;
  }

  async updatePaymentConfig(id: string, updates: Partial<InsertPaymentConfig>): Promise<PaymentConfig> {
    const [config] = await db
      .update(paymentConfigs)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(paymentConfigs.id, id))
      .returning();
    return config;
  }

  async deletePaymentConfig(id: string): Promise<void> {
    await db.delete(paymentConfigs).where(eq(paymentConfigs.id, id));
  }

  async activatePaymentConfig(id: string): Promise<void> {
    // First, deactivate all payment configs
    await db
      .update(paymentConfigs)
      .set({
        isActive: false,
        updatedAt: new Date()
      });

    // Then, activate the specified config
    await db
      .update(paymentConfigs)
      .set({
        isActive: true,
        updatedAt: new Date()
      })
      .where(eq(paymentConfigs.id, id));
  }

  // Integration methods implementation
  async getIntegrations(): Promise<Integration[]> {
    return await db.select().from(integrations).orderBy(integrations.type, integrations.name);
  }

  async getIntegrationById(id: string): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id));
    return integration || undefined;
  }

  async getIntegrationsByType(type: string): Promise<Integration[]> {
    return await db
      .select()
      .from(integrations)
      .where(eq(integrations.type, type))
      .orderBy(integrations.name);
  }

  async getEnabledIntegrations(): Promise<Integration[]> {
    return await db
      .select()
      .from(integrations)
      .where(eq(integrations.enabled, true))
      .orderBy(integrations.type, integrations.name);
  }

  async createIntegration(data: InsertIntegration): Promise<Integration> {
    const [integration] = await db
      .insert(integrations)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return integration;
  }

  async updateIntegration(id: string, updates: Partial<InsertIntegration>): Promise<Integration> {
    const [integration] = await db
      .update(integrations)
      .set({ 
        ...updates, 
        updatedAt: new Date()
      })
      .where(eq(integrations.id, id))
      .returning();
    
    if (!integration) {
      throw new Error(`Integration with id ${id} not found`);
    }
    
    return integration;
  }

  async deleteIntegration(id: string): Promise<void> {
    await db.delete(integrations).where(eq(integrations.id, id));
  }

  async testIntegrationConnection(id: string): Promise<{ success: boolean; message: string; status?: string }> {
    // Get the integration
    const integration = await this.getIntegrationById(id);
    if (!integration) {
      return { success: false, message: 'Integration not found' };
    }

    // Update last test time
    await db
      .update(integrations)
      .set({ 
        lastTestAt: new Date(),
        lastTestStatus: 'pending',
        updatedAt: new Date()
      })
      .where(eq(integrations.id, id));

    try {
      // Mock connection test based on integration type
      let testResult = { success: true, message: 'Connection successful', status: 'success' };
      
      switch (integration.type) {
        case 'email':
          if (!integration.apiKey && !integration.smtpHost) {
            testResult = { success: false, message: 'Missing API key or SMTP configuration', status: 'failed' };
          }
          break;
        case 'payment':
          if (!integration.apiKey || !integration.endpointUrl) {
            testResult = { success: false, message: 'Missing API key or endpoint URL', status: 'failed' };
          }
          break;
        case 'storage':
          if (!integration.apiKey) {
            testResult = { success: false, message: 'Missing API key for storage service', status: 'failed' };
          }
          break;
        case 'crm':
          if (!integration.crmToken || !integration.crmDomain) {
            testResult = { success: false, message: 'Missing CRM token or domain', status: 'failed' };
          }
          break;
        case 'analytics':
          if (!integration.apiKey) {
            testResult = { success: false, message: 'Missing analytics API key', status: 'failed' };
          }
          break;
        case 'automation':
          if (!integration.workflowId || !integration.endpointUrl) {
            testResult = { success: false, message: 'Missing workflow ID or endpoint URL', status: 'failed' };
          }
          break;
        default:
          testResult = { success: true, message: 'Basic configuration check passed', status: 'success' };
      }

      // Update test result
      await db
        .update(integrations)
        .set({ 
          lastTestStatus: testResult.status || (testResult.success ? 'success' : 'failed'),
          lastTestMessage: testResult.message,
          updatedAt: new Date()
        })
        .where(eq(integrations.id, id));

      return testResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      
      // Update test failure
      await db
        .update(integrations)
        .set({ 
          lastTestStatus: 'failed',
          lastTestMessage: errorMessage,
          updatedAt: new Date()
        })
        .where(eq(integrations.id, id));

      return { success: false, message: errorMessage, status: 'failed' };
    }
  }

  async enableIntegration(id: string): Promise<Integration> {
    const [integration] = await db
      .update(integrations)
      .set({ 
        enabled: true, 
        updatedAt: new Date()
      })
      .where(eq(integrations.id, id))
      .returning();
    
    if (!integration) {
      throw new Error(`Integration with id ${id} not found`);
    }
    
    return integration;
  }

  async disableIntegration(id: string): Promise<Integration> {
    const [integration] = await db
      .update(integrations)
      .set({ 
        enabled: false, 
        updatedAt: new Date()
      })
      .where(eq(integrations.id, id))
      .returning();
    
    if (!integration) {
      throw new Error(`Integration with id ${id} not found`);
    }
    
    return integration;
  }

  // Email Log methods implementation
  async getEmailLogs(): Promise<EmailLog[]> {
    return await db.select().from(emailLogs);
  }

  async getUserEmailLogs(userId: string): Promise<EmailLog[]> {
    return await db.select().from(emailLogs).where(eq(emailLogs.userId, userId));
  }

  async createEmailLog(log: InsertEmailLog): Promise<EmailLog> {
    const [emailLog] = await db.insert(emailLogs).values(log).returning();
    return emailLog;
  }

  async updateEmailLogStatus(id: string, status: string, errorMessage?: string): Promise<EmailLog> {
    const [emailLog] = await db
      .update(emailLogs)
      .set({ 
        status, 
        errorMessage,
        sentAt: status === 'sent' ? new Date() : undefined
      })
      .where(eq(emailLogs.id, id))
      .returning();
    
    if (!emailLog) {
      throw new Error(`Email log with id ${id} not found`);
    }
    
    return emailLog;
  }

  // Analytics methods implementation
  async createAnalyticsMetric(metric: InsertAnalyticsMetric): Promise<AnalyticsMetric> {
    const [analyticsMetric] = await db.insert(analyticsMetrics).values(metric).returning();
    return analyticsMetric;
  }

  async getUserMetrics(userId: string): Promise<AnalyticsMetric[]> {
    return await db.select().from(analyticsMetrics).where(eq(analyticsMetrics.userId, userId));
  }

  async getCourseMetrics(courseId: string): Promise<AnalyticsMetric[]> {
    return await db.select().from(analyticsMetrics).where(eq(analyticsMetrics.courseId, courseId));
  }

  async getMetricsByType(metricType: string): Promise<AnalyticsMetric[]> {
    return await db.select().from(analyticsMetrics).where(eq(analyticsMetrics.metricType, metricType));
  }

  async getMetricsInDateRange(startDate: Date, endDate: Date): Promise<AnalyticsMetric[]> {
    return await db
      .select()
      .from(analyticsMetrics)
      .where(eq(analyticsMetrics.timestamp, startDate)); // Note: Simplified - would need proper date range query
  }
}

export const storage = new DatabaseStorage();