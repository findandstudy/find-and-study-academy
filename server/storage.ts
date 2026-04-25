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
  popups,
  popupDismissals,
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
  type Popup,
  type InsertPopup,
  type PopupDismissal,
  type InsertPopupDismissal,
  type SystemSetting,
  type InsertSystemSetting,
  type PaymentConfig,
  type InsertPaymentConfig,
  type Integration,
  type InsertIntegration,
  type EmailLog,
  type InsertEmailLog,
  type AnalyticsMetric,
  type InsertAnalyticsMetric,
  findyConfig,
  findyConversations,
  findyMessages,
  integrationEvents,
  integrationApiKeys,
  type FindyConfig,
  type FindyConversation,
  type FindyMessage,
  type InsertFindyConfig,
  type InsertFindyConversation,
  type InsertFindyMessage,
  type IntegrationEvent,
  type IntegrationApiKey,
  type InsertIntegrationEvent,
  type InsertIntegrationApiKey,
  contentTranslations,
  type ContentTranslation,
  type InsertContentTranslation,
  announcementTranslations,
  type AnnouncementTranslation,
  type InsertAnnouncementTranslation,
  knowledgeSources,
  knowledgeChunks,
  type KnowledgeSource,
  type InsertKnowledgeSource,
  type KnowledgeChunk,
  type InsertKnowledgeChunk,
  partnerFolders,
  type PartnerFolder,
  type InsertPartnerFolder,
} from "@shared/schema";
import { db } from "./db";
import { eq, count, and, gte, lte, desc, sql as sqlExpr, like, or, ilike, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  
  // Password reset methods
  setResetToken(userId: string, token: string, expiry: Date): Promise<void>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  clearResetToken(userId: string): Promise<void>;
  
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

  // Popup methods
  getPopups(): Promise<Array<Popup & { creatorName?: string }>>;
  getPopupById(id: string): Promise<Popup | undefined>;
  createPopup(popup: InsertPopup): Promise<Popup>;
  updatePopup(id: string, updates: Partial<InsertPopup>): Promise<Popup>;
  deletePopup(id: string): Promise<void>;
  getActivePopupsForUser(userId: string, agencyId: string | null | undefined, role: string): Promise<Popup[]>;
  upsertPopupDismissal(data: InsertPopupDismissal): Promise<PopupDismissal>;
  getUserDismissals(userId: string): Promise<PopupDismissal[]>;

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
  getUserMetricsInDateRange(userId: string, startDate: Date, endDate: Date): Promise<AnalyticsMetric[]>;

  // Integration Event Log methods
  createIntegrationEvent(data: InsertIntegrationEvent): Promise<IntegrationEvent>;
  getIntegrationEvents(options?: { integrationId?: string; eventType?: string; status?: string; limit?: number }): Promise<IntegrationEvent[]>;
  updateIntegrationEventStatus(id: string, status: string, responseStatus?: number, responseBody?: string, durationMs?: number, errorMessage?: string): Promise<IntegrationEvent>;

  // Integration API Key methods
  createIntegrationApiKey(data: InsertIntegrationApiKey): Promise<IntegrationApiKey>;
  getIntegrationApiKeys(includeRevoked?: boolean): Promise<IntegrationApiKey[]>;
  revokeIntegrationApiKey(id: string, revokedBy: string): Promise<IntegrationApiKey>;
  getApiKeyByHash(keyHash: string): Promise<IntegrationApiKey | undefined>;

  // Content Translation methods
  getContentTranslations(contentId: string): Promise<ContentTranslation[]>;
  getContentTranslation(contentId: string, language: string): Promise<ContentTranslation | undefined>;
  upsertContentTranslation(data: InsertContentTranslation): Promise<ContentTranslation>;
  deleteContentTranslation(contentId: string, language: string): Promise<void>;
  getAllTranslations(): Promise<ContentTranslation[]>;

  // Announcement Translation methods
  getAnnouncementTranslations(announcementId: string): Promise<AnnouncementTranslation[]>;
  getAnnouncementTranslation(announcementId: string, language: string): Promise<AnnouncementTranslation | undefined>;
  getAnnouncementTranslationsForLanguage(announcementIds: string[], language: string): Promise<AnnouncementTranslation[]>;
  upsertAnnouncementTranslation(data: InsertAnnouncementTranslation): Promise<AnnouncementTranslation>;
  deleteAnnouncementTranslation(announcementId: string, language: string): Promise<void>;

  // Partner Folder methods
  getPartnerFolders(parentFolderId?: string | null): Promise<PartnerFolder[]>;
  getPartnerFolderById(id: string): Promise<PartnerFolder | undefined>;
  createPartnerFolder(folder: InsertPartnerFolder): Promise<PartnerFolder>;
  updatePartnerFolder(id: string, updates: Partial<InsertPartnerFolder>): Promise<PartnerFolder>;
  deletePartnerFolder(id: string): Promise<void>;
  getFolderContents(folderId: string): Promise<Content[]>;
  getFolderPath(folderId: string): Promise<PartnerFolder[]>;
  countFolderChildren(folderId: string): Promise<{ subfolders: number; contents: number }>;
  // For each given folder id, returns the set of normalized content types
  // ('document' | 'video' | 'image') found anywhere in its descendant tree
  // (including direct contents and contents of nested subfolders).
  getDescendantContentTypes(folderIds: string[]): Promise<Map<string, string[]>>;

  // Knowledge Source methods (Findy AI RAG)
  getKnowledgeSources(): Promise<KnowledgeSource[]>;
  getKnowledgeSourceById(id: string): Promise<KnowledgeSource | undefined>;
  createKnowledgeSource(data: InsertKnowledgeSource): Promise<KnowledgeSource>;
  updateKnowledgeSource(id: string, updates: Partial<KnowledgeSource>): Promise<KnowledgeSource>;
  deleteKnowledgeSource(id: string): Promise<void>;

  // Knowledge Chunk methods
  addKnowledgeChunks(chunks: InsertKnowledgeChunk[]): Promise<void>;
  deleteChunksBySourceId(sourceId: string): Promise<void>;
  searchKnowledgeChunks(query: string, limit?: number): Promise<KnowledgeChunk[]>;
  getChunksBySourceId(sourceId: string): Promise<KnowledgeChunk[]>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async setResetToken(userId: string, token: string, expiry: Date): Promise<void> {
    await db
      .update(users)
      .set({ 
        resetToken: token, 
        resetTokenExpiry: expiry 
      })
      .where(eq(users.id, userId));
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, token));
    return user || undefined;
  }

  async clearResetToken(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        resetToken: null, 
        resetTokenExpiry: null 
      })
      .where(eq(users.id, userId));
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
        contentType: contents.contentType,
        countryId: contents.countryId,
        countryCode: contents.countryCode,
        courseId: contents.courseId,
        quizId: contents.quizId,
        content: contents.content,
        videoUrl: contents.videoUrl,
        videoDuration: contents.videoDuration,
        documentUrl: contents.documentUrl,
        imageUrl: contents.imageUrl,
        altText: contents.altText,
        displayName: contents.displayName,
        fileSize: contents.fileSize,
        categoryTag: contents.categoryTag,
        language: contents.language,
        section: contents.section,
        status: contents.status,
        order: contents.order,
        folderId: contents.folderId,
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
      .orderBy(sqlExpr`${announcements.publishedAt} DESC NULLS LAST`, desc(announcements.createdAt));

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

  // Popup methods implementation
  async getPopups(): Promise<Array<Popup & { creatorName?: string }>> {
    const rows = await db
      .select({
        id: popups.id,
        title: popups.title,
        content: popups.content,
        imageUrl: popups.imageUrl,
        linkUrl: popups.linkUrl,
        linkText: popups.linkText,
        targetAudience: popups.targetAudience,
        targetAgencyIds: popups.targetAgencyIds,
        status: popups.status,
        startsAt: popups.startsAt,
        expiresAt: popups.expiresAt,
        frequency: popups.frequency,
        createdBy: popups.createdBy,
        createdAt: popups.createdAt,
        updatedAt: popups.updatedAt,
        creatorName: users.name,
      })
      .from(popups)
      .leftJoin(users, eq(popups.createdBy, users.id))
      .orderBy(desc(popups.createdAt));
    return rows.map(r => ({ ...r, creatorName: r.creatorName ?? undefined }));
  }

  async getPopupById(id: string): Promise<Popup | undefined> {
    const [row] = await db.select().from(popups).where(eq(popups.id, id));
    return row || undefined;
  }

  async createPopup(data: InsertPopup): Promise<Popup> {
    const [row] = await db
      .insert(popups)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return row;
  }

  async updatePopup(id: string, updates: Partial<InsertPopup>): Promise<Popup> {
    const [row] = await db
      .update(popups)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(popups.id, id))
      .returning();
    return row;
  }

  async deletePopup(id: string): Promise<void> {
    await db.delete(popupDismissals).where(eq(popupDismissals.popupId, id));
    await db.delete(popups).where(eq(popups.id, id));
  }

  async getActivePopupsForUser(
    userId: string,
    agencyId: string | null | undefined,
    role: string,
  ): Promise<Popup[]> {
    const now = new Date();
    const all = await db.select().from(popups).where(eq(popups.status, 'active'));
    return all.filter(p => {
      if (p.startsAt && new Date(p.startsAt) > now) return false;
      if (p.expiresAt && new Date(p.expiresAt) < now) return false;
      // Audience filter
      if (p.targetAudience === 'agents' && role !== 'agent') return false;
      if (p.targetAudience === 'specific') {
        if (!agencyId) return false;
        const ids = p.targetAgencyIds ?? [];
        if (!ids.includes(agencyId)) return false;
      }
      return true;
    });
  }

  async upsertPopupDismissal(data: InsertPopupDismissal): Promise<PopupDismissal> {
    const [row] = await db
      .insert(popupDismissals)
      .values({ ...data, dismissedAt: new Date() })
      .onConflictDoUpdate({
        target: [popupDismissals.popupId, popupDismissals.userId],
        set: {
          dismissedAt: new Date(),
          dontShowAgain: data.dontShowAgain ?? false,
        },
      })
      .returning();
    return row;
  }

  async getUserDismissals(userId: string): Promise<PopupDismissal[]> {
    return await db.select().from(popupDismissals).where(eq(popupDismissals.userId, userId));
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
      .where(and(gte(analyticsMetrics.timestamp, startDate), lte(analyticsMetrics.timestamp, endDate)));
  }

  async getUserMetricsInDateRange(userId: string, startDate: Date, endDate: Date): Promise<AnalyticsMetric[]> {
    return await db
      .select()
      .from(analyticsMetrics)
      .where(and(
        eq(analyticsMetrics.userId, userId),
        gte(analyticsMetrics.timestamp, startDate),
        lte(analyticsMetrics.timestamp, endDate)
      ));
  }

  // --- Findy AI ---
  async getFindyConfigs(): Promise<FindyConfig[]> {
    return await db.select().from(findyConfig);
  }

  async getFindyConfigByKey(key: string): Promise<FindyConfig | undefined> {
    const [row] = await db.select().from(findyConfig).where(eq(findyConfig.key, key));
    return row;
  }

  async setFindyConfig(key: string, value: string, updatedBy?: string): Promise<FindyConfig> {
    const existing = await this.getFindyConfigByKey(key);
    if (existing) {
      const [updated] = await db.update(findyConfig)
        .set({ value, updatedAt: new Date(), updatedBy })
        .where(eq(findyConfig.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(findyConfig)
        .values({ key, value, updatedBy })
        .returning();
      return created;
    }
  }

  async getFindyConversations(limit = 100): Promise<FindyConversation[]> {
    return await db.select().from(findyConversations)
      .orderBy(desc(findyConversations.startedAt))
      .limit(limit);
  }

  async getFindyConversationById(id: string): Promise<FindyConversation | undefined> {
    const [row] = await db.select().from(findyConversations).where(eq(findyConversations.id, id));
    return row;
  }

  async createFindyConversation(data: Partial<InsertFindyConversation>): Promise<FindyConversation> {
    const [conv] = await db.insert(findyConversations).values({
      sessionId: data.sessionId || crypto.randomUUID(),
      channel: data.channel || 'web',
      userId: data.userId,
    }).returning();
    return conv;
  }

  async updateFindyConversation(id: string, data: Partial<FindyConversation>): Promise<FindyConversation | undefined> {
    const [updated] = await db.update(findyConversations).set(data).where(eq(findyConversations.id, id)).returning();
    return updated;
  }

  async getFindyMessages(conversationId: string): Promise<FindyMessage[]> {
    return await db.select().from(findyMessages)
      .where(eq(findyMessages.conversationId, conversationId))
      .orderBy(findyMessages.createdAt);
  }

  async createFindyMessage(data: InsertFindyMessage): Promise<FindyMessage> {
    const [msg] = await db.insert(findyMessages).values(data).returning();
    return msg;
  }

  async getFindyAnalytics(): Promise<{ totalConversations: number; totalMessages: number; totalTokens: number; fallbackRate: number; last7Days: any[] }> {
    const [convStats] = await db.select({
      total: count(findyConversations.id),
      totalTokens: sqlExpr<number>`SUM(${findyConversations.tokenCount})`,
      totalFallbacks: sqlExpr<number>`SUM(${findyConversations.fallbackCount})`,
    }).from(findyConversations);

    const [msgStats] = await db.select({
      total: count(findyMessages.id),
    }).from(findyMessages);

    const totalConversations = Number(convStats?.total ?? 0);
    const totalTokens = Number(convStats?.totalTokens ?? 0);
    const totalFallbacks = Number(convStats?.totalFallbacks ?? 0);
    const totalMessages = Number(msgStats?.total ?? 0);

    return {
      totalConversations,
      totalMessages,
      totalTokens,
      fallbackRate: totalConversations > 0 ? (totalFallbacks / totalConversations) : 0,
      last7Days: [],
    };
  }

  // ---- Integration Event Log ----
  async createIntegrationEvent(data: InsertIntegrationEvent): Promise<IntegrationEvent> {
    const [event] = await db.insert(integrationEvents).values(data).returning();
    return event;
  }

  async getIntegrationEvents(options: { integrationId?: string; eventType?: string; status?: string; limit?: number } = {}): Promise<IntegrationEvent[]> {
    const { integrationId, eventType, status, limit = 200 } = options;
    const conditions = [];
    if (integrationId) conditions.push(eq(integrationEvents.integrationId, integrationId));
    if (eventType) conditions.push(eq(integrationEvents.eventType, eventType));
    if (status) conditions.push(eq(integrationEvents.status, status));

    const query = db.select().from(integrationEvents)
      .orderBy(desc(integrationEvents.createdAt))
      .limit(limit);

    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async updateIntegrationEventStatus(
    id: string,
    status: string,
    responseStatus?: number,
    responseBody?: string,
    durationMs?: number,
    errorMessage?: string
  ): Promise<IntegrationEvent> {
    const updates: any = { status };
    if (responseStatus !== undefined) updates.responseStatus = responseStatus;
    if (responseBody !== undefined) updates.responseBody = responseBody;
    if (durationMs !== undefined) updates.durationMs = durationMs;
    if (errorMessage !== undefined) updates.errorMessage = errorMessage;

    const [event] = await db.update(integrationEvents)
      .set(updates)
      .where(eq(integrationEvents.id, id))
      .returning();
    return event;
  }

  // ---- Integration API Keys ----
  async createIntegrationApiKey(data: InsertIntegrationApiKey): Promise<IntegrationApiKey> {
    const [key] = await db.insert(integrationApiKeys).values(data).returning();
    return key;
  }

  async getIntegrationApiKeys(includeRevoked = false): Promise<IntegrationApiKey[]> {
    const query = db.select().from(integrationApiKeys).orderBy(desc(integrationApiKeys.createdAt));
    if (!includeRevoked) {
      return await query.where(eq(integrationApiKeys.isActive, true));
    }
    return await query;
  }

  async revokeIntegrationApiKey(id: string, revokedBy: string): Promise<IntegrationApiKey> {
    const [key] = await db.update(integrationApiKeys)
      .set({ isActive: false, revokedAt: new Date(), revokedBy })
      .where(eq(integrationApiKeys.id, id))
      .returning();
    return key;
  }

  async getApiKeyByHash(keyHash: string): Promise<IntegrationApiKey | undefined> {
    const [key] = await db.select().from(integrationApiKeys)
      .where(and(eq(integrationApiKeys.keyHash, keyHash), eq(integrationApiKeys.isActive, true)));
    return key || undefined;
  }

  // Content Translation implementations
  async getContentTranslations(contentId: string): Promise<ContentTranslation[]> {
    return db.select().from(contentTranslations)
      .where(eq(contentTranslations.contentId, contentId))
      .orderBy(contentTranslations.language);
  }

  async getContentTranslation(contentId: string, language: string): Promise<ContentTranslation | undefined> {
    const [row] = await db.select().from(contentTranslations)
      .where(and(
        eq(contentTranslations.contentId, contentId),
        eq(contentTranslations.language, language)
      ));
    return row || undefined;
  }

  async upsertContentTranslation(data: InsertContentTranslation): Promise<ContentTranslation> {
    const existing = await this.getContentTranslation(data.contentId, data.language);
    if (existing) {
      const [updated] = await db.update(contentTranslations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(contentTranslations.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(contentTranslations)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return created;
  }

  async deleteContentTranslation(contentId: string, language: string): Promise<void> {
    await db.delete(contentTranslations)
      .where(and(
        eq(contentTranslations.contentId, contentId),
        eq(contentTranslations.language, language)
      ));
  }

  async getAllTranslations(): Promise<ContentTranslation[]> {
    return db.select().from(contentTranslations)
      .orderBy(contentTranslations.contentId, contentTranslations.language);
  }

  // Announcement Translation implementations
  async getAnnouncementTranslations(announcementId: string): Promise<AnnouncementTranslation[]> {
    return db.select().from(announcementTranslations)
      .where(eq(announcementTranslations.announcementId, announcementId))
      .orderBy(announcementTranslations.language);
  }

  async getAnnouncementTranslation(announcementId: string, language: string): Promise<AnnouncementTranslation | undefined> {
    const [row] = await db.select().from(announcementTranslations)
      .where(and(
        eq(announcementTranslations.announcementId, announcementId),
        eq(announcementTranslations.language, language)
      ));
    return row || undefined;
  }

  async getAnnouncementTranslationsForLanguage(announcementIds: string[], language: string): Promise<AnnouncementTranslation[]> {
    if (announcementIds.length === 0) return [];
    const { inArray } = await import("drizzle-orm");
    return db.select().from(announcementTranslations)
      .where(and(
        inArray(announcementTranslations.announcementId, announcementIds),
        eq(announcementTranslations.language, language)
      ));
  }

  async upsertAnnouncementTranslation(data: InsertAnnouncementTranslation): Promise<AnnouncementTranslation> {
    const [row] = await db.insert(announcementTranslations)
      .values({ ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [announcementTranslations.announcementId, announcementTranslations.language],
        set: {
          title: data.title,
          content: data.content,
          translatedBy: data.translatedBy,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async deleteAnnouncementTranslation(announcementId: string, language: string): Promise<void> {
    await db.delete(announcementTranslations)
      .where(and(
        eq(announcementTranslations.announcementId, announcementId),
        eq(announcementTranslations.language, language)
      ));
  }

  // ── Partner Folder implementations ──────────────────────────────────────────
  async getPartnerFolders(parentFolderId?: string | null): Promise<PartnerFolder[]> {
    // When parentFolderId is undefined → return ALL folders (admin flat listing).
    // When null → root folders only. When string → folders under that parent.
    if (parentFolderId === undefined) {
      return db.select().from(partnerFolders).orderBy(partnerFolders.order, partnerFolders.name);
    }
    if (parentFolderId === null) {
      return db.select().from(partnerFolders)
        .where(isNull(partnerFolders.parentFolderId))
        .orderBy(partnerFolders.order, partnerFolders.name);
    }
    return db.select().from(partnerFolders)
      .where(eq(partnerFolders.parentFolderId, parentFolderId))
      .orderBy(partnerFolders.order, partnerFolders.name);
  }

  async getPartnerFolderById(id: string): Promise<PartnerFolder | undefined> {
    const [folder] = await db.select().from(partnerFolders).where(eq(partnerFolders.id, id));
    return folder || undefined;
  }

  async createPartnerFolder(data: InsertPartnerFolder): Promise<PartnerFolder> {
    const [created] = await db.insert(partnerFolders).values({ ...data, updatedAt: new Date() }).returning();
    return created;
  }

  async updatePartnerFolder(id: string, updates: Partial<InsertPartnerFolder>): Promise<PartnerFolder> {
    const [updated] = await db.update(partnerFolders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(partnerFolders.id, id))
      .returning();
    return updated;
  }

  async deletePartnerFolder(id: string): Promise<void> {
    // Block deletion when subfolders or contents exist; caller surfaces the error.
    const { subfolders, contents: contentCount } = await this.countFolderChildren(id);
    if (subfolders > 0 || contentCount > 0) {
      throw new Error(
        `Klasör boş değil: ${subfolders} alt klasör ve ${contentCount} içerik var. Önce bunları silin veya taşıyın.`
      );
    }
    await db.delete(partnerFolders).where(eq(partnerFolders.id, id));
  }

  async getFolderContents(folderId: string): Promise<Content[]> {
    return db.select().from(contents)
      .where(eq(contents.folderId, folderId))
      .orderBy(contents.order, contents.title);
  }

  async getFolderPath(folderId: string): Promise<PartnerFolder[]> {
    // Walk up the parent chain until root. Cycle-safe via visited Set —
    // unbounded depth (no hard cap) to honor the "unlimited nesting" requirement.
    const path: PartnerFolder[] = [];
    const visited = new Set<string>();
    let currentId: string | null = folderId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const folder = await this.getPartnerFolderById(currentId);
      if (!folder) break;
      path.unshift(folder);
      currentId = folder.parentFolderId ?? null;
    }
    return path;
  }

  async countFolderChildren(folderId: string): Promise<{ subfolders: number; contents: number }> {
    const [subResult] = await db.select({ value: count() }).from(partnerFolders)
      .where(eq(partnerFolders.parentFolderId, folderId));
    const [contentResult] = await db.select({ value: count() }).from(contents)
      .where(eq(contents.folderId, folderId));
    return {
      subfolders: Number(subResult?.value ?? 0),
      contents: Number(contentResult?.value ?? 0),
    };
  }

  async getDescendantContentTypes(folderIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (folderIds.length === 0) return result;

    // One-shot reads of the parent->child folder graph and the content rows
    // that live in any folder. Sets are then computed in-memory.
    const allFolders = await db
      .select({ id: partnerFolders.id, parentFolderId: partnerFolders.parentFolderId })
      .from(partnerFolders);
    const allContents = await db
      .select({ folderId: contents.folderId, type: contents.type, contentType: contents.contentType })
      .from(contents);

    const childMap = new Map<string, string[]>();
    for (const f of allFolders) {
      if (!f.parentFolderId) continue;
      const list = childMap.get(f.parentFolderId);
      if (list) list.push(f.id);
      else childMap.set(f.parentFolderId, [f.id]);
    }

    const directTypes = new Map<string, Set<string>>();
    for (const c of allContents) {
      if (!c.folderId) continue;
      const raw = (c.contentType ?? c.type ?? 'document').toLowerCase();
      const norm = raw === 'video' ? 'video' : raw === 'image' ? 'image' : 'document';
      const set = directTypes.get(c.folderId);
      if (set) set.add(norm);
      else directTypes.set(c.folderId, new Set([norm]));
    }

    for (const rootId of folderIds) {
      const types = new Set<string>();
      const stack: string[] = [rootId];
      const seen = new Set<string>();
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const direct = directTypes.get(id);
        if (direct) direct.forEach(t => types.add(t));
        const kids = childMap.get(id);
        if (kids) for (const k of kids) stack.push(k);
      }
      result.set(rootId, Array.from(types));
    }
    return result;
  }

  // ── Knowledge Source implementations ────────────────────────────────────────
  async getKnowledgeSources(): Promise<KnowledgeSource[]> {
    return db.select().from(knowledgeSources).orderBy(desc(knowledgeSources.createdAt));
  }

  async getKnowledgeSourceById(id: string): Promise<KnowledgeSource | undefined> {
    const [src] = await db.select().from(knowledgeSources).where(eq(knowledgeSources.id, id));
    return src || undefined;
  }

  async createKnowledgeSource(data: InsertKnowledgeSource): Promise<KnowledgeSource> {
    const [created] = await db.insert(knowledgeSources).values(data).returning();
    return created;
  }

  async updateKnowledgeSource(id: string, updates: Partial<KnowledgeSource>): Promise<KnowledgeSource> {
    const [updated] = await db.update(knowledgeSources)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(knowledgeSources.id, id))
      .returning();
    return updated;
  }

  async deleteKnowledgeSource(id: string): Promise<void> {
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, id));
    await db.delete(knowledgeSources).where(eq(knowledgeSources.id, id));
  }

  async addKnowledgeChunks(chunks: InsertKnowledgeChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const BATCH = 200;
    for (let i = 0; i < chunks.length; i += BATCH) {
      await db.insert(knowledgeChunks).values(chunks.slice(i, i + BATCH));
    }
  }

  async deleteChunksBySourceId(sourceId: string): Promise<void> {
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, sourceId));
  }

  async searchKnowledgeChunks(
    query: string,
    limit = 12,
    opts?: { university?: string; country?: string }
  ): Promise<KnowledgeChunk[]> {
    // Turkish-aware normalization so "Bahçeşehir" matches "Bahcesehir" etc.
    const normalize = (s: string) => (s || '').toLowerCase()
      .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/İ/gi, 'i')
      .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
      .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');

    // Strip common Turkish suffixes (locative, ablative, dative, possessive,
    // plural) so "burdurda" / "burdurdan" / "üniversitesinde" all collapse to
    // their stems. Order matters — try the longest suffix first. We only
    // strip when the remaining stem is at least 4 chars to avoid shredding
    // short tokens like "var".
    const TR_SUFFIXES = [
      'larinda', 'lerinde', 'larindan', 'lerinden',
      'larina', 'lerine', 'sinde', 'sinda', 'sinden', 'sindan',
      'larin', 'lerin', 'lardan', 'lerden', 'larda', 'lerde',
      'lari', 'leri', 'nden', 'ndan', 'nde', 'nda',
      'nin', 'nun', 'nun', 'nin', 'sini', 'sinu',
      'dir', 'tir', 'dur', 'tur',
      'lar', 'ler', 'den', 'dan', 'ten', 'tan',
      'de', 'da', 'te', 'ta', 'in', 'un', 'sı', 'si', 'su', 'le', 'la',
    ];
    const stripSuffix = (t: string): string => {
      for (const sfx of TR_SUFFIXES) {
        if (t.length >= sfx.length + 4 && t.endsWith(sfx)) {
          return t.slice(0, -sfx.length);
        }
      }
      return t;
    };

    // Small TR→EN dictionary for the highest-traffic vocabulary the user is
    // likely to type in Turkish while the source data is in English. We add
    // the EN equivalent as an extra search term — so a question about
    // "üniversite" / "ücret" / "lisans" actually matches the English Excel
    // rows. Keep this list focused on study-abroad nouns; this is a search
    // hint, not a translation layer.
    const TR_TO_EN: Record<string, string[]> = {
      universite: ['university'], uni: ['university'],
      universiteler: ['university', 'universities'],
      fakulte: ['faculty'], bolum: ['department'],
      muhendislik: ['engineering'], tip: ['medicine'], hukuk: ['law'],
      isletme: ['business'], iktisat: ['economics'], egitim: ['education'],
      mimarlik: ['architecture'], sanat: ['art'],
      bilgisayar: ['computer'], yazilim: ['software'],
      elektrik: ['electrical'], makine: ['mechanical'],
      endustri: ['industrial'], insaat: ['civil'],
      kimya: ['chemistry'], fizik: ['physics'], matematik: ['mathematics'],
      biyoloji: ['biology'], psikoloji: ['psychology'], sosyoloji: ['sociology'],
      iletisim: ['communication'], gazetecilik: ['journalism'],
      hemsirelik: ['nursing'], veteriner: ['veterinary'],
      eczacilik: ['pharmacy'], dis: ['dentistry'],
      ucret: ['fee', 'tuition'], ucretler: ['fee', 'tuition'],
      fiyat: ['fee', 'tuition'], burs: ['scholarship'],
      lisans: ['bachelor'], onlisans: ['associate'],
      doktora: ['phd', 'doctorate'], yuksek: ['master'],
      sehir: ['city'], ulke: ['country'],
      turkiye: ['turkey'], almanya: ['germany'], letonya: ['latvia'],
      cin: ['china'], abd: ['usa', 'united states'],
      ingilizce: ['english'], turkce: ['turkish'],
      almanca: ['german'], rusca: ['russian'], cince: ['chinese'],
      basvuru: ['application'], kabul: ['admission'],
      baslangic: ['intake'], sure: ['duration'],
      dil: ['language'], ay: ['month'], yil: ['year'],
    };

    const normalized = normalize(query.trim());
    const rawTokens = normalized.split(/[\s,.;:!?()|/]+/).filter(t => t.length > 2);

    // Expand each token into: itself + stripped stem + EN translation(s).
    const expanded = new Set<string>();
    for (const t of rawTokens) {
      expanded.add(t);
      const stem = stripSuffix(t);
      if (stem !== t && stem.length > 2) expanded.add(stem);
      const enList = TR_TO_EN[t] || TR_TO_EN[stem];
      if (enList) for (const en of enList) expanded.add(en);
    }
    // Cap so very long questions don't blow up SQL OR width.
    const terms = Array.from(expanded).slice(0, 16);
    if (terms.length === 0) return [];

    // Each term may match either column; we OR them so chunks that mention any
    // term become candidates. We deliberately fetch more than `limit` so we can
    // rerank in JS by how many distinct terms each chunk matched (a cheap TF
    // proxy that beats ILIKE-OR's "first found wins" behavior).
    const conditions = terms.map(t =>
      or(
        ilike(knowledgeChunks.content, `%${t}%`),
        ilike(knowledgeChunks.keywords, `%${t}%`)
      )
    );
    const candidateLimit = Math.max(60, limit * 5);
    const candidates = await db.select()
      .from(knowledgeChunks)
      .where(or(...conditions))
      .limit(candidateLimit);

    // Optional metadata pre-filter: when the caller already extracted an entity
    // (e.g. a university or country mentioned in the question) we only keep
    // rows whose metadata matches. This keeps token use down on large corpora.
    let filtered = candidates;
    if (opts?.university) {
      const u = normalize(opts.university);
      filtered = filtered.filter(c => {
        const m: any = c.metadata;
        return m?.Universities && normalize(String(m.Universities)).includes(u);
      });
    }
    if (opts?.country) {
      const co = normalize(opts.country);
      filtered = filtered.filter(c => {
        const m: any = c.metadata;
        return m?.Country && normalize(String(m.Country)).includes(co);
      });
    }

    // Score by number of distinct terms present in (normalized) keywords+content.
    const scored = filtered.map(c => {
      const hay = normalize(`${c.keywords || ''} ${c.content || ''}`);
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score += 1;
      return { c, score };
    }).filter(x => x.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(x => x.c);
  }

  async getChunksBySourceId(sourceId: string): Promise<KnowledgeChunk[]> {
    return db.select().from(knowledgeChunks)
      .where(eq(knowledgeChunks.sourceId, sourceId))
      .limit(10);
  }
}

export const storage = new DatabaseStorage();