import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { 
  insertCertificateSchema, 
  insertAgencySchema, 
  insertCountrySchema,
  insertContentSchema,
  insertQuizSchema,
  type Agency, 
  type InsertAgency,
  type Country,
  type InsertCountry,
  type Content,
  type InsertContent,
  type Quiz,
  type InsertQuiz
} from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";

// Server-side questions validation schema (matches frontend)
const questionSchema = z.discriminatedUnion('type', [
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
    options: z.array(z.string().min(1, 'Option text required')).min(2, 'At least 2 options required').max(6, 'Maximum 6 options allowed'),
    answerIndex: z.number().min(0)
  })
]);

// Quiz validation schema with questions validation
const quizValidationSchema = insertQuizSchema.extend({
  questions: z.string().refine((val) => {
    try {
      const parsed = JSON.parse(val);
      z.array(questionSchema).min(1, 'At least 1 question required').parse(parsed);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid questions format - must be valid JSON array of question objects')
}).refine(
  (data) => {
    // If quiz is a final exam, countryId is required
    if (data.isFinal && !data.countryId) {
      return false;
    }
    return true;
  },
  {
    message: 'Country is required for Final Exams',
    path: ['countryId']
  }
);

// Separate schema for updates (allows partial)
const quizUpdateSchema = insertQuizSchema.extend({
  questions: z.string().refine((val) => {
    try {
      const parsed = JSON.parse(val);
      z.array(questionSchema).min(1, 'At least 1 question required').parse(parsed);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid questions format - must be valid JSON array of question objects').optional()
}).partial().refine(
  (data) => {
    // If quiz is being set as final exam, countryId must be provided
    if (data.isFinal === true && !data.countryId) {
      return false;
    }
    return true;
  },
  {
    message: 'Country is required for Final Exams',
    path: ['countryId']
  }
);

// Authentication middleware - verify user session with server-side validation
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract user ID from headers (client sends this from their session)
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Server-side validation: Verify user exists in storage and get their actual role
    const users = await storage.getUsers();
    const user = users.find(u => u.id === userId);
    
    console.log('[AUTH] User lookup:', { userId, found: !!user, agencyId: user?.agencyId });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user credentials'
      });
    }

    // Add VERIFIED user info to request (role comes from server, not client)
    (req as any).user = { 
      id: user.id, 
      role: user.role,  // Use actual role from storage, not client-provided
      email: user.email,
      agencyId: user.agencyId  // Include agencyId for agents
    };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid authentication'
    });
  }
}

// Generate secure certificate code with high entropy
function generateSecureCertificateCode(): string {
  const randomBytes = crypto.randomBytes(8);
  const code = randomBytes.toString('hex').toUpperCase().substring(0, 12);
  return `FAS-${code}`;
}

// Configure multer for profile picture uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // PUBLIC API endpoints for agents (no authentication required for published content)
  
  // Get active countries with published content
  app.get('/api/public/countries', async (req, res) => {
    try {
      const countries = await storage.getCountries();
      const contents = await storage.getContents();
      
      // Filter to only active countries that have published content
      const activeCountriesWithContent = countries.filter(country => {
        if (country.status !== 'active') return false;
        return contents.some(content => 
          content.countryId === country.id && 
          content.status === 'published'
        );
      });
      
      res.json({
        success: true,
        countries: activeCountriesWithContent
      });
    } catch (error) {
      console.error('Public countries error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch countries'
      });
    }
  });

  // Get published content (optionally filtered by countryId)
  app.get('/api/public/contents', async (req, res) => {
    try {
      const { countryId } = req.query;
      const contents = await storage.getContents();
      const countries = await storage.getCountries();
      
      // Filter to only published content
      let publishedContents = contents.filter(content => content.status === 'published');
      
      // Optionally filter by country
      if (countryId && typeof countryId === 'string') {
        publishedContents = publishedContents.filter(content => content.countryId === countryId);
      }
      
      // Add country name to each content
      const contentsWithCountryName = publishedContents.map(content => {
        const country = countries.find(c => c.id === content.countryId);
        return {
          ...content,
          countryName: country?.name || 'Unknown'
        };
      });
      
      res.json({
        success: true,
        contents: contentsWithCountryName
      });
    } catch (error) {
      console.error('Public contents error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch contents'
      });
    }
  });

  // Get all quizzes for agent access
  app.get('/api/public/quizzes', async (req, res) => {
    try {
      const quizzes = await storage.getQuizzes();
      
      // Parse questions JSON string to array for each quiz
      const parsedQuizzes = quizzes.map(quiz => {
        let questions = [];
        if (quiz.questions) {
          try {
            questions = typeof quiz.questions === 'string' 
              ? JSON.parse(quiz.questions) 
              : quiz.questions;
          } catch (e) {
            console.error(`Failed to parse questions for quiz ${quiz.id}:`, e);
            questions = [];
          }
        }
        return {
          ...quiz,
          questions
        };
      });
      
      res.json({
        success: true,
        quizzes: parsedQuizzes
      });
    } catch (error) {
      console.error('Public quizzes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quizzes'
      });
    }
  });

  // Login endpoint - authenticate user and return user data
  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const users = await storage.getUsers();
      const user = users.find(u => u.email === email && u.password === password);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          agencyId: user.agencyId,
          profilePicture: user.profilePicture
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  });

  // Signup endpoint - create new agent user and agency
  app.post('/api/signup', async (req, res) => {
    try {
      const { name, email, password, agencyName } = req.body;

      if (!name || !email || !password || !agencyName) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }

      // Check if email already exists
      const users = await storage.getUsers();
      const existingUser = users.find(u => u.email === email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      const userId = `agent-${Date.now()}`;
      const agencyId = `agency-${Date.now()}`;

      // Create agency
      const newAgency = {
        id: agencyId,
        name: agencyName,
        status: 'active' as const,
        primaryContactName: name,
        primaryContactEmail: email
      };

      // Create user
      const newUser = {
        id: userId,
        username: email,
        password: password,
        name: name,
        email: email,
        role: 'agent' as const,
        agencyId: agencyId,
        emailNotifications: true,
        courseCompletionNotif: true,
        certificateNotif: true,
        announcementNotif: true
      };

      const createdAgency = await storage.createAgency(newAgency);
      const createdUser = await storage.createUser(newUser);

      res.status(201).json({
        success: true,
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
          agencyId: createdUser.agencyId
        },
        agency: createdAgency
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Signup failed'
      });
    }
  });

  // Session validation endpoint - validates user exists in database
  app.get('/api/me', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      
      res.json({
        success: true,
        user: {
          id: authenticatedUser.id,
          email: authenticatedUser.email,
          role: authenticatedUser.role,
          agencyId: authenticatedUser.agencyId
        }
      });
    } catch (error) {
      console.error('Session validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate session'
      });
    }
  });

  // Quiz attempt submission endpoint (required for certificate validation)
  app.post('/api/attempts', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { quizId, scorePercent, correct, incorrect } = req.body;

      // Basic validation
      if (!quizId || scorePercent === undefined || correct === undefined || incorrect === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: quizId, scorePercent, correct, incorrect'
        });
      }

      if (scorePercent < 0 || scorePercent > 100) {
        return res.status(400).json({
          success: false,
          message: 'Score percent must be between 0 and 100'
        });
      }

      // Create attempt record
      const attempt = {
        id: `attempt-${Date.now()}-${authenticatedUser.id}`,
        userId: authenticatedUser.id,
        quizId,
        scorePercent: parseInt(scorePercent),
        correct: parseInt(correct),
        incorrect: parseInt(incorrect),
        date: new Date()  // Use Date object instead of ISO string for PostgreSQL timestamp
      };

      // Save to database
      const savedAttempt = await storage.addAttempt(attempt);

      res.status(201).json({
        success: true,
        attempt: {
          id: savedAttempt.id,
          scorePercent: savedAttempt.scorePercent,
          date: savedAttempt.date
        }
      });
    } catch (error) {
      console.error('Attempt submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during attempt submission'
      });
    }
  });

  // SECURE Certificate issuance endpoint
  app.post('/api/certificates', requireAuth, async (req, res) => {
    try {
      // Extract authenticated user from middleware
      const authenticatedUser = (req as any).user;
      const { courseId, quizId } = req.body;

      // Validate required fields using Zod
      const certificateValidation = insertCertificateSchema.pick({
        courseId: true
      }).safeParse({ courseId });

      if (!certificateValidation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: certificateValidation.error.errors
        });
      }

      if (!quizId) {
        return res.status(400).json({
          success: false,
          message: 'Quiz ID is required for certificate verification'
        });
      }

      // CRITICAL: Validate quiz-course relationship and final exam status
      const quiz = await storage.getQuizById(quizId);
      if (!quiz) {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found'
        });
      }

      // Ensure quiz belongs to the requested course
      if (quiz.courseId !== courseId) {
        return res.status(400).json({
          success: false,
          message: 'Quiz does not belong to the specified course'
        });
      }

      // Ensure only final exams can issue certificates
      if (!quiz.isFinal) {
        return res.status(400).json({
          success: false,
          message: 'Only final exams can issue certificates'
        });
      }

      // Verify course exists
      const courses = await storage.getCourses();
      const courseExists = courses.some(c => c.id === courseId);
      if (!courseExists) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      // Verify user actually passed the final exam by checking their latest attempt
      const attempts = await storage.getAttempts();
      const userAttempts = attempts.filter(a => 
        a.userId === authenticatedUser.id && 
        a.quizId === quizId
      );

      if (userAttempts.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No quiz attempts found. Please complete the exam first.'
        });
      }

      // Get the latest attempt
      const latestAttempt = userAttempts.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];

      // Verify passing score using quiz-specific threshold
      if (latestAttempt.scorePercent < quiz.passPercent) {
        return res.status(403).json({
          success: false,
          message: `Insufficient score: ${latestAttempt.scorePercent}%. Minimum ${quiz.passPercent}% required.`
        });
      }

      // Check if certificate already exists for this user/course
      const existingCertificates = await storage.getCertificates();
      const existingCert = existingCertificates.find(c => 
        c.userId === authenticatedUser.id && c.courseId === courseId
      );

      if (existingCert) {
        return res.status(409).json({
          success: false,
          message: 'Certificate already issued for this course',
          certificate: {
            id: existingCert.id,
            code: existingCert.code,
            scorePercent: existingCert.scorePercent,
            issuedAt: existingCert.issuedAt
          }
        });
      }

      // Generate secure certificate code with retry mechanism
      let attempts_count = 0;
      let certificateCode: string;
      
      do {
        certificateCode = generateSecureCertificateCode();
        attempts_count++;
        
        // Check for uniqueness
        const codeExists = existingCertificates.some(c => c.code === certificateCode);
        if (!codeExists) break;
        
        if (attempts_count >= 10) {
          throw new Error('Failed to generate unique certificate code');
        }
      } while (attempts_count < 10);

      // Create certificate in database with server-verified data
      const certificate = await storage.addCertificate({
        userId: authenticatedUser.id,
        courseId: certificateValidation.data.courseId,
        scorePercent: latestAttempt.scorePercent,
        code: certificateCode
      });

      res.status(201).json({
        success: true,
        certificate: {
          id: certificate.id,
          code: certificate.code,
          scorePercent: certificate.scorePercent,
          issuedAt: certificate.issuedAt
        }
      });
    } catch (error) {
      console.error('Certificate issuance error:', error);
      
      // Handle unique constraint violations
      if (error instanceof Error && error.message.includes('unique')) {
        return res.status(409).json({
          success: false,
          message: 'Certificate code conflict. Please try again.'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error during certificate issuance'
      });
    }
  });

  // Get user certificates endpoint
  app.get('/api/certificates', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      
      // Get all certificates for the authenticated user
      const allCertificates = await storage.getCertificates();
      const userCertificates = allCertificates.filter(cert => 
        cert.userId === authenticatedUser.id
      );

      res.json({
        success: true,
        certificates: userCertificates
      });
    } catch (error) {
      console.error('Certificates retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during certificates retrieval'
      });
    }
  });

  // Certificate verification endpoint
  app.get('/api/verify', async (req, res) => {
    try {
      const { code } = req.query;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Certificate code is required' 
        });
      }

      // Get certificate by code from database
      const certificate = await storage.getCertificateByCode(code);

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message: 'Certificate not found',
          code: code
        });
      }

      // Get user and course information
      const user = await storage.getUser(certificate.userId);
      const courses = await storage.getCourses();
      
      const course = courses.find(c => c.id === certificate.courseId);

      res.json({
        success: true,
        certificate: {
          id: certificate.id,
          code: certificate.code,
          scorePercent: certificate.scorePercent,
          issuedAt: certificate.issuedAt,
          user: user ? { id: user.id, name: user.name } : null,
          course: course ? { id: course.id, title: course.title } : null
        }
      });
    } catch (error) {
      console.error('Certificate verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during verification'
      });
    }
  });

  // Admin certificates endpoint - get all certificates for management
  app.get('/api/admin/certificates', requireAuth, requireAdmin, async (req, res) => {
    try {
      // Get all certificates with user and course information
      const allCertificates = await storage.getCertificates();
      const users = await storage.getUsers();
      const courses = await storage.getCourses();

      // Enrich certificates with user and course data
      const enrichedCertificates = allCertificates.map(cert => {
        const user = users.find(u => u.id === cert.userId);
        const course = courses.find(c => c.id === cert.courseId);
        
        return {
          id: cert.id,
          code: cert.code,
          scorePercent: cert.scorePercent,
          issuedAt: cert.issuedAt,
          user: user ? {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          } : null,
          course: course ? {
            id: course.id,
            title: course.title,
            slug: course.slug
          } : null
        };
      });

      res.json({
        success: true,
        certificates: enrichedCertificates
      });
    } catch (error) {
      console.error('Admin certificates retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during admin certificates retrieval'
      });
    }
  });

  // Admin user management endpoints
  app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      // Get all users with their agency information
      const allUsers = await storage.getUsers();
      const agencies = await storage.getAgencies();

      // Enrich users with agency data and remove sensitive info
      const enrichedUsers = allUsers.map(user => {
        const { password, ...userWithoutPassword } = user;
        const agency = agencies.find(a => a.id === user.agencyId);
        
        return {
          ...userWithoutPassword,
          agency: agency ? {
            id: agency.id,
            name: agency.name,
            country: agency.country,
            city: agency.city
          } : null
        };
      });

      res.json({
        success: true,
        users: enrichedUsers
      });
    } catch (error) {
      console.error('Admin users retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during admin users retrieval'
      });
    }
  });

  // Update user role and information (admin only)
  app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role, name, email } = req.body;

      // Validate role if provided
      if (role && !['admin', 'agent'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be admin or agent.'
        });
      }

      // Check if user exists
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Prepare update data
      const updates: any = {};
      if (role !== undefined) updates.role = role;
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;

      const updatedUser = await storage.updateUser(id, updates);
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json({
        success: true,
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('User update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user'
      });
    }
  });

  // Admin analytics endpoints
  app.get('/api/admin/analytics/overview', requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const certificates = await storage.getCertificates();
      const attempts = await storage.getAttempts();
      const agencies = await storage.getAgencies();

      // Calculate overview statistics
      const totalUsers = users.length;
      const totalCertificates = certificates.length;
      const totalAttempts = attempts.length;
      const totalAgencies = agencies.length;

      // Calculate monthly certificate issuance
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const certificatesThisMonth = certificates.filter(cert => 
        new Date(cert.issuedAt) >= thisMonth
      ).length;

      // Calculate average quiz score
      const totalScore = attempts.reduce((sum, attempt) => sum + attempt.scorePercent, 0);
      const averageScore = attempts.length > 0 ? Math.round(totalScore / attempts.length) : 0;

      // Calculate pass rate (70% threshold)
      const passedAttempts = attempts.filter(attempt => attempt.scorePercent >= 70).length;
      const passRate = attempts.length > 0 ? Math.round((passedAttempts / attempts.length) * 100) : 0;

      res.json({
        success: true,
        overview: {
          totalUsers,
          totalCertificates,
          totalAttempts,
          totalAgencies,
          certificatesThisMonth,
          averageScore,
          passRate
        }
      });
    } catch (error) {
      console.error('Analytics overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics overview'
      });
    }
  });

  app.get('/api/admin/analytics/charts', requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const certificates = await storage.getCertificates();
      const attempts = await storage.getAttempts();
      const agencies = await storage.getAgencies();

      // User role distribution
      const userRoleData = [
        { name: 'Administrators', value: users.filter(u => u.role === 'admin').length },
        { name: 'Agents', value: users.filter(u => u.role === 'agent').length }
      ];

      // Certificate issuance over last 6 months
      const certificateMonthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleString('default', { month: 'short' });
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const count = certificates.filter(cert => {
          const certDate = new Date(cert.issuedAt);
          return certDate >= monthStart && certDate <= monthEnd;
        }).length;
        
        certificateMonthlyData.push({ month: monthName, certificates: count });
      }

      // Agency distribution by country
      const countryStats = agencies.reduce((acc: any, agency) => {
        const country = agency.country || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {});
      
      const agencyCountryData = Object.entries(countryStats).map(([country, count]) => ({
        country,
        agencies: count
      }));

      // Quiz performance over time (last 30 attempts)
      const recentAttempts = attempts
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30)
        .reverse();

      const quizPerformanceData = recentAttempts.map((attempt, index) => ({
        attempt: index + 1,
        score: attempt.scorePercent
      }));

      // Score distribution
      const scoreRanges = [
        { range: '0-30%', count: 0 },
        { range: '31-50%', count: 0 },
        { range: '51-69%', count: 0 },
        { range: '70-85%', count: 0 },
        { range: '86-100%', count: 0 }
      ];

      attempts.forEach(attempt => {
        const score = attempt.scorePercent;
        if (score <= 30) scoreRanges[0].count++;
        else if (score <= 50) scoreRanges[1].count++;
        else if (score <= 69) scoreRanges[2].count++;
        else if (score <= 85) scoreRanges[3].count++;
        else scoreRanges[4].count++;
      });

      res.json({
        success: true,
        charts: {
          userRoles: userRoleData,
          certificateMonthly: certificateMonthlyData,
          agencyCountries: agencyCountryData,
          quizPerformance: quizPerformanceData,
          scoreDistribution: scoreRanges
        }
      });
    } catch (error) {
      console.error('Analytics charts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics charts'
      });
    }
  });

  // Admin announcements management endpoints
  app.get('/api/admin/announcements', requireAuth, requireAdmin, async (req, res) => {
    try {
      const announcements = await storage.getAnnouncements();
      res.json({
        success: true,
        announcements
      });
    } catch (error) {
      console.error('Admin announcements retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve announcements'
      });
    }
  });

  app.post('/api/admin/announcements', requireAuth, requireAdmin, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { title, content, type, priority, targetAudience, status, publishedAt, expiresAt } = req.body;

      // Validate required fields
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: 'Title and content are required'
        });
      }

      // Create announcement with creator info
      const announcementData = {
        title,
        content,
        type: type || 'info',
        priority: priority || 'medium',
        targetAudience: targetAudience || 'all',
        status: status || 'draft',
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: authenticatedUser.id
      };

      const newAnnouncement = await storage.createAnnouncement(announcementData);

      res.json({
        success: true,
        message: 'Announcement created successfully',
        announcement: newAnnouncement
      });
    } catch (error) {
      console.error('Create announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create announcement'
      });
    }
  });

  app.put('/api/admin/announcements/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content, type, priority, targetAudience, status, publishedAt, expiresAt } = req.body;

      // Check if announcement exists
      const existingAnnouncement = await storage.getAnnouncementById(id);
      if (!existingAnnouncement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      // Update announcement
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (type !== undefined) updateData.type = type;
      if (priority !== undefined) updateData.priority = priority;
      if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
      if (status !== undefined) updateData.status = status;
      if (publishedAt !== undefined) updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
      if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

      const updatedAnnouncement = await storage.updateAnnouncement(id, updateData);

      res.json({
        success: true,
        message: 'Announcement updated successfully',
        announcement: updatedAnnouncement
      });
    } catch (error) {
      console.error('Update announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update announcement'
      });
    }
  });

  app.delete('/api/admin/announcements/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Check if announcement exists
      const existingAnnouncement = await storage.getAnnouncementById(id);
      if (!existingAnnouncement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      await storage.deleteAnnouncement(id);

      res.json({
        success: true,
        message: 'Announcement deleted successfully'
      });
    } catch (error) {
      console.error('Delete announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete announcement'
      });
    }
  });

  // Agent announcements endpoint - public announcements for agents
  app.get('/api/announcements', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      
      const announcements = await storage.getAnnouncements();
      
      const activeAnnouncements = announcements.filter(a => {
        const isPublished = a.status === 'published';
        const isTargeted = a.targetAudience === 'all' || 
                          (authenticatedUser.role === 'agent' && a.targetAudience === 'agents') ||
                          (authenticatedUser.role === 'admin' && a.targetAudience === 'admins');
        const notExpired = !a.expiresAt || new Date(a.expiresAt) > new Date();
        return isPublished && isTargeted && notExpired;
      });

      res.json({
        success: true,
        announcements: activeAnnouncements
      });
    } catch (error) {
      console.error('Agent announcements retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve announcements'
      });
    }
  });

  // System Settings endpoints
  app.get('/api/admin/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json({
        success: true,
        settings
      });
    } catch (error) {
      console.error('Settings retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve system settings'
      });
    }
  });

  app.post('/api/admin/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { key, value, category, type, description, isPublic } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Key and value are required'
        });
      }

      const settingData = {
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        category: category || 'general',
        type: type || 'string',
        description,
        isPublic: isPublic || false,
        updatedBy: authenticatedUser.id
      };

      const newSetting = await storage.createSystemSetting(settingData);

      res.json({
        success: true,
        message: 'Setting created successfully',
        setting: newSetting
      });
    } catch (error) {
      console.error('Create setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create setting'
      });
    }
  });

  app.put('/api/admin/settings/:key', requireAuth, requireAdmin, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { key } = req.params;
      const { value, category, type, description, isPublic } = req.body;

      const existingSetting = await storage.getSystemSettingByKey(key);
      if (!existingSetting) {
        return res.status(404).json({
          success: false,
          message: 'Setting not found'
        });
      }

      const updateData: any = {
        updatedBy: authenticatedUser.id
      };
      if (value !== undefined) updateData.value = typeof value === 'string' ? value : JSON.stringify(value);
      if (category !== undefined) updateData.category = category;
      if (type !== undefined) updateData.type = type;
      if (description !== undefined) updateData.description = description;
      if (isPublic !== undefined) updateData.isPublic = isPublic;

      const updatedSetting = await storage.updateSystemSetting(key, updateData);

      res.json({
        success: true,
        message: 'Setting updated successfully',
        setting: updatedSetting
      });
    } catch (error) {
      console.error('Update setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update setting'
      });
    }
  });

  app.delete('/api/admin/settings/:key', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { key } = req.params;

      const existingSetting = await storage.getSystemSettingByKey(key);
      if (!existingSetting) {
        return res.status(404).json({
          success: false,
          message: 'Setting not found'
        });
      }

      await storage.deleteSystemSetting(key);

      res.json({
        success: true,
        message: 'Setting deleted successfully'
      });
    } catch (error) {
      console.error('Delete setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete setting'
      });
    }
  });

  // Payment Configuration endpoints
  app.get('/api/admin/payment-configs', requireAuth, requireAdmin, async (req, res) => {
    try {
      const configs = await storage.getPaymentConfigs();
      
      // Mask sensitive data in response
      const maskedConfigs = configs.map(config => ({
        ...config,
        secretKey: config.secretKey ? '***masked***' : null,
        webhookSecret: config.webhookSecret ? '***masked***' : null
      }));

      res.json({
        success: true,
        configs: maskedConfigs
      });
    } catch (error) {
      console.error('Payment configs retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve payment configurations'
      });
    }
  });

  app.get('/api/admin/payment-configs/active', requireAuth, requireAdmin, async (req, res) => {
    try {
      const activeConfig = await storage.getActivePaymentConfig();
      
      if (activeConfig) {
        // Mask sensitive data
        const maskedConfig = {
          ...activeConfig,
          secretKey: activeConfig.secretKey ? '***masked***' : null,
          webhookSecret: activeConfig.webhookSecret ? '***masked***' : null
        };
        
        res.json({
          success: true,
          config: maskedConfig
        });
      } else {
        res.json({
          success: true,
          config: null
        });
      }
    } catch (error) {
      console.error('Active payment config retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve active payment configuration'
      });
    }
  });

  app.post('/api/admin/payment-configs', requireAuth, requireAdmin, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { 
        provider, 
        enabled, 
        displayName, 
        publicKey, 
        secretKey, 
        webhookSecret, 
        successUrl, 
        cancelUrl,
        settings 
      } = req.body;

      if (!provider) {
        return res.status(400).json({
          success: false,
          message: 'Provider is required'
        });
      }

      const configData = {
        provider,
        enabled: enabled || false,
        displayName,
        publicKey,
        secretKey, // Note: In production, these should be encrypted
        webhookSecret, // Note: In production, these should be encrypted
        successUrl,
        cancelUrl,
        settings: settings ? JSON.stringify(settings) : null,
        isActive: false, // New configs start inactive
        updatedBy: authenticatedUser.id
      };

      const newConfig = await storage.createPaymentConfig(configData);

      // Mask sensitive data in response
      const maskedConfig = {
        ...newConfig,
        secretKey: newConfig.secretKey ? '***masked***' : null,
        webhookSecret: newConfig.webhookSecret ? '***masked***' : null
      };

      res.json({
        success: true,
        message: 'Payment configuration created successfully',
        config: maskedConfig
      });
    } catch (error) {
      console.error('Create payment config error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment configuration'
      });
    }
  });

  app.put('/api/admin/payment-configs/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { id } = req.params;
      const { 
        provider, 
        enabled, 
        displayName, 
        publicKey, 
        secretKey, 
        webhookSecret, 
        successUrl, 
        cancelUrl,
        settings 
      } = req.body;

      const existingConfig = await storage.getPaymentConfigById(id);
      if (!existingConfig) {
        return res.status(404).json({
          success: false,
          message: 'Payment configuration not found'
        });
      }

      const updateData: any = {
        updatedBy: authenticatedUser.id
      };
      if (provider !== undefined) updateData.provider = provider;
      if (enabled !== undefined) updateData.enabled = enabled;
      if (displayName !== undefined) updateData.displayName = displayName;
      if (publicKey !== undefined) updateData.publicKey = publicKey;
      if (secretKey !== undefined) updateData.secretKey = secretKey; // In production, encrypt this
      if (webhookSecret !== undefined) updateData.webhookSecret = webhookSecret; // In production, encrypt this
      if (successUrl !== undefined) updateData.successUrl = successUrl;
      if (cancelUrl !== undefined) updateData.cancelUrl = cancelUrl;
      if (settings !== undefined) updateData.settings = settings ? JSON.stringify(settings) : null;

      const updatedConfig = await storage.updatePaymentConfig(id, updateData);

      // Mask sensitive data in response
      const maskedConfig = {
        ...updatedConfig,
        secretKey: updatedConfig.secretKey ? '***masked***' : null,
        webhookSecret: updatedConfig.webhookSecret ? '***masked***' : null
      };

      res.json({
        success: true,
        message: 'Payment configuration updated successfully',
        config: maskedConfig
      });
    } catch (error) {
      console.error('Update payment config error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update payment configuration'
      });
    }
  });

  app.post('/api/admin/payment-configs/:id/activate', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const existingConfig = await storage.getPaymentConfigById(id);
      if (!existingConfig) {
        return res.status(404).json({
          success: false,
          message: 'Payment configuration not found'
        });
      }

      await storage.activatePaymentConfig(id);

      res.json({
        success: true,
        message: 'Payment configuration activated successfully'
      });
    } catch (error) {
      console.error('Activate payment config error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to activate payment configuration'
      });
    }
  });

  app.delete('/api/admin/payment-configs/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const existingConfig = await storage.getPaymentConfigById(id);
      if (!existingConfig) {
        return res.status(404).json({
          success: false,
          message: 'Payment configuration not found'
        });
      }

      await storage.deletePaymentConfig(id);

      res.json({
        success: true,
        message: 'Payment configuration deleted successfully'
      });
    } catch (error) {
      console.error('Delete payment config error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete payment configuration'
      });
    }
  });

  // Object Storage: Get presigned URL for profile picture upload
  app.post('/api/profile-picture/upload-url', requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get upload URL'
      });
    }
  });

  // Object Storage: Update profile picture after upload
  app.put('/api/profile-picture', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { profilePictureURL } = req.body;

      if (!profilePictureURL) {
        return res.status(400).json({
          success: false,
          message: 'profilePictureURL is required'
        });
      }

      const objectStorageService = new ObjectStorageService();
      
      // Set ACL policy for the uploaded profile picture (public visibility)
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        profilePictureURL,
        {
          owner: authenticatedUser.id,
          visibility: "public", // Profile pictures are public
        }
      );

      // Update user profile picture in database
      const updatedUser = await storage.updateUser(authenticatedUser.id, { profilePicture: objectPath });

      console.log('[PROFILE PICTURE UPDATE] Success:', {
        userId: authenticatedUser.id,
        profilePictureURL: objectPath,
        updatedUserProfilePicture: updatedUser?.profilePicture
      });

      res.json({
        success: true,
        url: objectPath
      });
    } catch (error) {
      console.error('Error updating profile picture:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile picture'
      });
    }
  });

  // Object Storage: Get presigned URL for agency logo upload
  app.post('/api/agency-logo/upload-url', requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get upload URL'
      });
    }
  });

  // Object Storage: Update agency logo after upload
  app.put('/api/agency-logo', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { agencyId, logoUrl } = req.body;

      if (!logoUrl || !agencyId) {
        return res.status(400).json({
          success: false,
          message: 'logoUrl and agencyId are required'
        });
      }

      const objectStorageService = new ObjectStorageService();
      
      // Set ACL policy for the uploaded logo (public visibility)
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        logoUrl,
        {
          owner: authenticatedUser.id,
          visibility: "public", // Agency logos are public
        }
      );

      // Update agency logo in database
      const updatedAgency = await storage.updateAgency(agencyId, { logoUrl: objectPath });

      console.log('[AGENCY LOGO UPDATE] Success:', {
        agencyId,
        logoUrl: objectPath,
        updatedAgencyLogoUrl: updatedAgency?.logoUrl
      });

      res.json({
        success: true,
        url: objectPath
      });
    } catch (error) {
      console.error('Error updating agency logo:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update agency logo'
      });
    }
  });

  // Agent: Get own agency information
  app.get('/api/agency', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      
      // Only agents can access their agency
      if (authenticatedUser.role !== 'agent') {
        return res.status(403).json({
          success: false,
          message: 'Only agents can access agency information'
        });
      }

      const agencyId = authenticatedUser.agencyId;
      if (!agencyId) {
        return res.status(400).json({
          success: false,
          message: 'Agent does not have an associated agency'
        });
      }

      const agencies = await storage.getAgencies();
      const agency = agencies.find(a => a.id === agencyId);

      if (!agency) {
        return res.status(404).json({
          success: false,
          message: 'Agency not found'
        });
      }

      res.json({
        success: true,
        agency
      });
    } catch (error) {
      console.error('[AGENCY GET] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch agency information'
      });
    }
  });

  // Agent: Update own agency information
  app.put('/api/agency', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      
      console.log('[AGENCY UPDATE] Request from user:', { 
        id: authenticatedUser.id, 
        role: authenticatedUser.role, 
        agencyId: authenticatedUser.agencyId,
        requestBody: req.body
      });
      
      // Only agents can update their own agency
      if (authenticatedUser.role !== 'agent') {
        console.log('[AGENCY UPDATE] Forbidden: User is not an agent');
        return res.status(403).json({
          success: false,
          message: 'Only agents can update their agency'
        });
      }

      const agencyId = authenticatedUser.agencyId;
      if (!agencyId) {
        console.log('[AGENCY UPDATE] ERROR: No agencyId found for user:', authenticatedUser);
        return res.status(400).json({
          success: false,
          message: 'Agent does not have an associated agency'
        });
      }

      // Validate agency data (partial update)
      const validation = insertAgencySchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        console.log('[AGENCY UPDATE] Validation failed:', validation.error.errors);
        return res.status(400).json({
          success: false,
          message: 'Invalid agency data',
          errors: validation.error.errors
        });
      }

      console.log('[AGENCY UPDATE] Validated data:', validation.data);

      // Update agency in database
      const updatedAgency = await storage.updateAgency(agencyId, validation.data);

      if (!updatedAgency) {
        console.log('[AGENCY UPDATE] ERROR: Agency not found with ID:', agencyId);
        return res.status(404).json({
          success: false,
          message: 'Agency not found'
        });
      }

      console.log('[AGENCY UPDATE] Success:', { agencyId, updatedFields: Object.keys(validation.data) });

      res.json({
        success: true,
        agency: updatedAgency
      });
    } catch (error) {
      console.error('[AGENCY UPDATE] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update agency'
      });
    }
  });

  // Object Storage: Serve profile pictures and other private objects  
  app.get('/objects/:objectPath(*)', async (req, res) => {
    try {
      // Try to get authenticated user (optional for public objects)
      let userId: string | undefined;
      try {
        const token = req.headers['x-user-id'] as string;
        if (token) {
          const users = await storage.getUsers();
          const user = users.find(u => u.id === token);
          if (user) {
            userId = user.id;
          }
        }
      } catch (authError) {
        // Auth failed, userId remains undefined (ok for public objects)
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      
      // Check ACL permissions (public objects don't need auth)
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId,
        requestedPermission: ObjectPermission.READ,
      });

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error('Error serving object:', error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({
          success: false,
          message: 'Object not found'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  // Get current user endpoint
  app.get('/api/me', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      
      // Get complete user data from storage (already verified by requireAuth)
      const users = await storage.getUsers();
      const user = users.find(u => u.id === authenticatedUser.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Return user data without password, using server-validated role
      const { password, ...userWithoutPassword } = user;
      
      res.json({
        success: true,
        user: userWithoutPassword,
        role: user.role  // Use server-side role, not client-provided
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user data'
      });
    }
  });

  // Admin-only middleware
  async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }
      
      next();
    } catch (error) {
      res.status(403).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  }

  // Agency management routes (admin only)
  app.get('/api/admin/agencies', requireAuth, requireAdmin, async (req, res) => {
    try {
      const agencies = await storage.getAgencies();
      res.json({
        success: true,
        agencies
      });
    } catch (error) {
      console.error('Get agencies error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve agencies'
      });
    }
  });

  app.post('/api/admin/agencies', requireAuth, requireAdmin, async (req, res) => {
    try {
      const validation = insertAgencySchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid agency data',
          errors: validation.error.errors
        });
      }

      const agency = await storage.createAgency(validation.data);
      
      res.status(201).json({
        success: true,
        agency
      });
    } catch (error) {
      console.error('Create agency error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create agency'
      });
    }
  });

  app.patch('/api/admin/agencies/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertAgencySchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid agency data',
          errors: validation.error.errors
        });
      }

      // Check if agency exists
      const existingAgency = await storage.getAgencyById(id);
      if (!existingAgency) {
        return res.status(404).json({
          success: false,
          message: 'Agency not found'
        });
      }

      const agency = await storage.updateAgency(id, validation.data);
      
      res.json({
        success: true,
        agency
      });
    } catch (error) {
      console.error('Update agency error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update agency'
      });
    }
  });

  app.delete('/api/admin/agencies/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Check if agency exists
      const existingAgency = await storage.getAgencyById(id);
      if (!existingAgency) {
        return res.status(404).json({
          success: false,
          message: 'Agency not found'
        });
      }

      await storage.deleteAgency(id);
      
      res.json({
        success: true,
        message: 'Agency deleted successfully'
      });
    } catch (error) {
      console.error('Delete agency error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete agency'
      });
    }
  });

  // Countries management routes (admin only)
  app.get('/api/admin/countries', requireAuth, requireAdmin, async (req, res) => {
    try {
      const countries = await storage.getCountries();
      res.json({
        success: true,
        countries
      });
    } catch (error) {
      console.error('Get countries error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve countries'
      });
    }
  });

  app.post('/api/admin/countries', requireAuth, requireAdmin, async (req, res) => {
    try {
      const validation = insertCountrySchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid country data',
          errors: validation.error.errors
        });
      }

      const country = await storage.createCountry(validation.data);
      
      res.status(201).json({
        success: true,
        country
      });
    } catch (error) {
      console.error('Create country error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create country'
      });
    }
  });

  app.patch('/api/admin/countries/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertCountrySchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid country data',
          errors: validation.error.errors
        });
      }

      const existingCountry = await storage.getCountryById(id);
      if (!existingCountry) {
        return res.status(404).json({
          success: false,
          message: 'Country not found'
        });
      }

      const country = await storage.updateCountry(id, validation.data);
      
      res.json({
        success: true,
        country
      });
    } catch (error) {
      console.error('Update country error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update country'
      });
    }
  });

  app.delete('/api/admin/countries/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const existingCountry = await storage.getCountryById(id);
      if (!existingCountry) {
        return res.status(404).json({
          success: false,
          message: 'Country not found'
        });
      }

      await storage.deleteCountry(id);
      
      res.json({
        success: true,
        message: 'Country deleted successfully'
      });
    } catch (error) {
      console.error('Delete country error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete country'
      });
    }
  });

  // Content management routes (admin only)
  app.get('/api/admin/contents', requireAuth, requireAdmin, async (req, res) => {
    try {
      const contents = await storage.getContents();
      res.json({
        success: true,
        contents
      });
    } catch (error) {
      console.error('Get contents error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve contents'
      });
    }
  });

  app.post('/api/admin/contents', requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log('[CREATE CONTENT] Request body:', JSON.stringify(req.body, null, 2));
      
      const validation = insertContentSchema.safeParse(req.body);
      
      if (!validation.success) {
        console.log('[CREATE CONTENT] Validation failed:', validation.error.errors);
        return res.status(400).json({
          success: false,
          message: 'Invalid content data',
          errors: validation.error.errors
        });
      }

      console.log('[CREATE CONTENT] Validated data:', JSON.stringify(validation.data, null, 2));
      
      const content = await storage.createContent(validation.data);
      
      console.log('[CREATE CONTENT] Created content:', JSON.stringify(content, null, 2));
      
      res.status(201).json({
        success: true,
        content
      });
    } catch (error) {
      console.error('Create content error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create content'
      });
    }
  });

  app.patch('/api/admin/contents/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertContentSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid content data',
          errors: validation.error.errors
        });
      }

      const existingContent = await storage.getContentById(id);
      if (!existingContent) {
        return res.status(404).json({
          success: false,
          message: 'Content not found'
        });
      }

      const content = await storage.updateContent(id, validation.data);
      
      res.json({
        success: true,
        content
      });
    } catch (error) {
      console.error('Update content error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update content'
      });
    }
  });

  app.delete('/api/admin/contents/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const existingContent = await storage.getContentById(id);
      if (!existingContent) {
        return res.status(404).json({
          success: false,
          message: 'Content not found'
        });
      }

      await storage.deleteContent(id);
      
      res.json({
        success: true,
        message: 'Content deleted successfully'
      });
    } catch (error) {
      console.error('Delete content error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete content'
      });
    }
  });

  // Quiz management routes (admin only)
  app.get('/api/admin/quizzes', requireAuth, requireAdmin, async (req, res) => {
    try {
      const quizzes = await storage.getQuizzes();
      
      // Parse questions JSON for each quiz
      const quizzesWithParsedQuestions = quizzes.map(quiz => ({
        ...quiz,
        questions: quiz.questions ? JSON.parse(quiz.questions) : []
      }));
      
      res.json({
        success: true,
        quizzes: quizzesWithParsedQuestions
      });
    } catch (error) {
      console.error('Get quizzes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve quizzes'
      });
    }
  });

  app.post('/api/admin/quizzes', requireAuth, requireAdmin, async (req, res) => {
    try {
      const validation = quizValidationSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid quiz data',
          errors: validation.error.errors
        });
      }

      // Convert questions array to JSON string for storage
      const quizData = {
        ...validation.data,
        questions: JSON.stringify(validation.data.questions || [])
      };

      const quiz = await storage.createQuiz(quizData);
      
      // Parse questions back to object for response
      const responseQuiz = {
        ...quiz,
        questions: quiz.questions ? JSON.parse(quiz.questions) : []
      };
      
      res.status(201).json({
        success: true,
        quiz: responseQuiz
      });
    } catch (error) {
      console.error('Create quiz error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create quiz'
      });
    }
  });

  app.patch('/api/admin/quizzes/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = quizUpdateSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid quiz data',
          errors: validation.error.errors
        });
      }

      const existingQuiz = await storage.getQuizById(id);
      if (!existingQuiz) {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found'
        });
      }

      // Convert questions array to JSON string if provided
      const updateData = {
        ...validation.data,
        ...(validation.data.questions && {
          questions: JSON.stringify(validation.data.questions)
        })
      };

      const quiz = await storage.updateQuiz(id, updateData);
      
      // Parse questions back to object for response
      const responseQuiz = {
        ...quiz,
        questions: quiz.questions ? JSON.parse(quiz.questions) : []
      };
      
      res.json({
        success: true,
        quiz: responseQuiz
      });
    } catch (error) {
      console.error('Update quiz error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update quiz'
      });
    }
  });

  app.delete('/api/admin/quizzes/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const existingQuiz = await storage.getQuizById(id);
      if (!existingQuiz) {
        return res.status(404).json({
          success: false,
          message: 'Quiz not found'
        });
      }

      await storage.deleteQuiz(id);
      
      res.json({
        success: true,
        message: 'Quiz deleted successfully'
      });
    } catch (error) {
      console.error('Delete quiz error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete quiz'
      });
    }
  });

  // Integration management endpoints
  app.get('/api/admin/integrations', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { type, enabled } = req.query;
      let integrations;

      if (type) {
        integrations = await storage.getIntegrationsByType(type as string);
      } else if (enabled === 'true') {
        integrations = await storage.getEnabledIntegrations();
      } else {
        integrations = await storage.getIntegrations();
      }

      // Mask sensitive data in API responses
      const maskedIntegrations = integrations.map(integration => ({
        ...integration,
        apiKey: integration.apiKey ? '***masked***' : null,
        apiSecret: integration.apiSecret ? '***masked***' : null,
        webhookSecret: integration.webhookSecret ? '***masked***' : null,
        smtpPass: integration.smtpPass ? '***masked***' : null,
        crmToken: integration.crmToken ? '***masked***' : null,
      }));

      res.json({
        success: true,
        integrations: maskedIntegrations,
        count: maskedIntegrations.length
      });
    } catch (error) {
      console.error('Error fetching integrations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch integrations'
      });
    }
  });

  app.post('/api/admin/integrations', requireAuth, requireAdmin, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { 
        name, 
        type, 
        enabled, 
        displayName, 
        description,
        endpointUrl,
        apiKey,
        apiSecret,
        webhookSecret,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        fromEmail,
        sheetId,
        tabName,
        crmDomain,
        crmToken,
        workflowId,
        settings
      } = req.body;

      if (!name || !type) {
        return res.status(400).json({
          success: false,
          message: 'Name and type are required'
        });
      }

      const validTypes = ['payment', 'email', 'storage', 'crm', 'analytics', 'automation'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid integration type. Must be one of: ' + validTypes.join(', ')
        });
      }

      const newIntegration = await storage.createIntegration({
        name,
        type,
        enabled: enabled || false,
        displayName,
        description,
        endpointUrl,
        apiKey,
        apiSecret,
        webhookSecret,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        fromEmail,
        sheetId,
        tabName,
        crmDomain,
        crmToken,
        workflowId,
        settings: settings ? JSON.stringify(settings) : undefined,
        createdBy: authenticatedUser.id,
        updatedBy: authenticatedUser.id
      });

      const maskedIntegration = {
        ...newIntegration,
        apiKey: newIntegration.apiKey ? '***masked***' : null,
        apiSecret: newIntegration.apiSecret ? '***masked***' : null,
        webhookSecret: newIntegration.webhookSecret ? '***masked***' : null,
        smtpPass: newIntegration.smtpPass ? '***masked***' : null,
        crmToken: newIntegration.crmToken ? '***masked***' : null,
      };

      res.status(201).json({
        success: true,
        integration: maskedIntegration,
        message: 'Integration created successfully'
      });
    } catch (error) {
      console.error('Error creating integration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create integration'
      });
    }
  });

  app.put('/api/admin/integrations/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { id } = req.params;
      const updates = req.body;

      const existingIntegration = await storage.getIntegrationById(id);
      if (!existingIntegration) {
        return res.status(404).json({
          success: false,
          message: 'Integration not found'
        });
      }

      const filteredUpdates = { ...updates };
      ['apiKey', 'apiSecret', 'webhookSecret', 'smtpPass', 'crmToken'].forEach(key => {
        if (filteredUpdates[key] === '') {
          delete filteredUpdates[key];
        }
      });

      if (filteredUpdates.settings && typeof filteredUpdates.settings !== 'string') {
        filteredUpdates.settings = JSON.stringify(filteredUpdates.settings);
      }

      const updatedIntegration = await storage.updateIntegration(id, {
        ...filteredUpdates,
        updatedBy: authenticatedUser.id
      });

      const maskedIntegration = {
        ...updatedIntegration,
        apiKey: updatedIntegration.apiKey ? '***masked***' : null,
        apiSecret: updatedIntegration.apiSecret ? '***masked***' : null,
        webhookSecret: updatedIntegration.webhookSecret ? '***masked***' : null,
        smtpPass: updatedIntegration.smtpPass ? '***masked***' : null,
        crmToken: updatedIntegration.crmToken ? '***masked***' : null,
      };

      res.json({
        success: true,
        integration: maskedIntegration,
        message: 'Integration updated successfully'
      });
    } catch (error) {
      console.error('Error updating integration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update integration'
      });
    }
  });

  app.post('/api/admin/integrations/:id/test', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const integration = await storage.getIntegrationById(id);
      if (!integration) {
        return res.status(404).json({
          success: false,
          message: 'Integration not found'
        });
      }

      const testResult = await storage.testIntegrationConnection(id);

      res.json({
        success: true,
        testResult,
        message: testResult.success ? 'Connection test successful' : 'Connection test failed'
      });
    } catch (error) {
      console.error('Error testing integration connection:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test integration connection'
      });
    }
  });

  app.post('/api/admin/integrations/:id/enable', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const integration = await storage.getIntegrationById(id);
      if (!integration) {
        return res.status(404).json({
          success: false,
          message: 'Integration not found'
        });
      }

      const enabledIntegration = await storage.enableIntegration(id);

      const maskedIntegration = {
        ...enabledIntegration,
        apiKey: enabledIntegration.apiKey ? '***masked***' : null,
        apiSecret: enabledIntegration.apiSecret ? '***masked***' : null,
        webhookSecret: enabledIntegration.webhookSecret ? '***masked***' : null,
        smtpPass: enabledIntegration.smtpPass ? '***masked***' : null,
        crmToken: enabledIntegration.crmToken ? '***masked***' : null,
      };

      res.json({
        success: true,
        integration: maskedIntegration,
        message: 'Integration enabled successfully'
      });
    } catch (error) {
      console.error('Error enabling integration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to enable integration'
      });
    }
  });

  app.delete('/api/admin/integrations/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const integration = await storage.getIntegrationById(id);
      if (!integration) {
        return res.status(404).json({
          success: false,
          message: 'Integration not found'
        });
      }

      await storage.deleteIntegration(id);

      res.json({
        success: true,
        message: 'Integration deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting integration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete integration'
      });
    }
  });

  // Menu Visibility Management
  app.get('/api/menu-visibility', requireAuth, async (req, res) => {
    try {
      const setting = await storage.getSystemSettingByKey('agent_menu_visibility');
      
      if (setting && setting.value) {
        const visibility = JSON.parse(setting.value);
        res.json(visibility);
      } else {
        // Default: all visible
        res.json({
          dashboard: true,
          courses: true,
          certificates: true,
          leaderboard: true,
          agency: true,
          'exams-orders': true,
          subscriptions: true,
          profile: true,
        });
      }
    } catch (error) {
      console.error('Error getting menu visibility:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get menu visibility settings'
      });
    }
  });

  app.put('/api/menu-visibility', requireAuth, requireAdmin, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const visibility = req.body;

      // Check if setting exists
      const existingSetting = await storage.getSystemSettingByKey('agent_menu_visibility');

      if (existingSetting) {
        // Update existing setting
        await storage.updateSystemSetting('agent_menu_visibility', {
          value: JSON.stringify(visibility),
          updatedBy: authenticatedUser.id,
        });
      } else {
        // Create new setting
        await storage.createSystemSetting({
          key: 'agent_menu_visibility',
          value: JSON.stringify(visibility),
          category: 'appearance',
          type: 'json',
          description: 'Agent sidebar menu visibility settings',
          isPublic: true,
          updatedBy: authenticatedUser.id,
        });
      }

      res.json({
        success: true,
        message: 'Menu visibility settings updated successfully'
      });
    } catch (error) {
      console.error('Error updating menu visibility:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update menu visibility settings'
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
