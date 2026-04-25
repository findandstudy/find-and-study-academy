import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
import sharp from "sharp";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";

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

    // Block inactive (pending-approval or deactivated) accounts on every authenticated request.
    // Strict check: anything other than 'active' (including null/undefined/empty string) is denied.
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Hesabınız henüz onaylanmadı veya pasif durumda. Lütfen yöneticinizle iletişime geçin.'
      });
    }

    // Add VERIFIED user info to request (role comes from server, not client)
    (req as any).user = { 
      id: user.id, 
      role: user.role,  // Use actual role from storage, not client-provided
      email: user.email,
      name: user.name,
      agencyId: user.agencyId,
      // Include notification preferences for email triggers
      emailNotifications: user.emailNotifications,
      certificateNotif: user.certificateNotif,
      courseCompletionNotif: user.courseCompletionNotif,
      announcementNotif: user.announcementNotif
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

// ── Rate Limiters ────────────────────────────────────────────────────────────
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: 'Too many password reset requests, please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120,
  message: { success: false, message: 'API rate limit exceeded, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/admin'), // Skip admin routes
});

// ── Configure multer for local file uploads ──────────────────────────────────
// Profile pictures upload configuration
const profilePictureStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'profiles');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

// Agency logos upload configuration
const agencyLogoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'logos');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'logo-' + uniqueSuffix + ext);
  }
});

// Shared file filter for image uploads
const imageFileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const profilePictureUpload = multer({
  storage: profilePictureStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: imageFileFilter
});

const agencyLogoUpload = multer({
  storage: agencyLogoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: imageFileFilter
});

// Content uploads — images, documents and videos for course content
const contentUploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder: string;
    if (file.mimetype.startsWith('image/')) folder = 'images';
    else if (file.mimetype.startsWith('video/')) folder = 'videos';
    else folder = 'documents';
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'content', folder);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'content-' + uniqueSuffix + ext);
  }
});

const contentFileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xlsx|ppt|pptx|mp4|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  if (extname) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'));
  }
};

const contentUpload = multer({
  storage: contentUploadStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos/docs
  fileFilter: contentFileFilter,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // PUBLIC API endpoints for agents (no authentication required for published content)
  
  // Get active countries with published content
  app.get('/api/public/countries', async (req, res) => {
    try {
      const countries = await storage.getCountries();
      const contents = await storage.getContents();
      
      // If includeAll query param is set, return all active countries (for admin use)
      const includeAll = req.query.includeAll === 'true';
      
      let activeCountriesWithContent;
      if (includeAll) {
        // Admin needs all active countries, even without content
        activeCountriesWithContent = countries.filter(country => country.status === 'active');
      } else {
        // Filter to only active countries that have published content
        activeCountriesWithContent = countries.filter(country => {
          if (country.status !== 'active') return false;
          return contents.some(content => 
            content.countryId === country.id && 
            content.status === 'published'
          );
        });
      }
      
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
      
      // Filter only active quizzes for agent access
      const activeQuizzes = quizzes.filter(q => q.status === 'active');
      
      // Parse questions JSON string to array for each quiz
      const parsedQuizzes = activeQuizzes.map(quiz => {
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

  // Public endpoint: get default settings for agent frontend
  app.get('/api/settings/defaults', async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      const defaultCountry = settings.find(s => s.key === 'default_country_code');
      const defaultCourse = settings.find(s => s.key === 'default_course_id');
      res.json({
        success: true,
        defaults: {
          default_country_code: defaultCountry?.value || null,
          default_course_id: defaultCourse?.value || null,
        }
      });
    } catch (error) {
      console.error('Settings defaults error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch defaults' });
    }
  });

  // Get all courses - no auth required for certificate downloads
  app.get('/api/courses', async (req, res) => {
    try {
      const courses = await storage.getCourses();
      
      res.json({
        success: true,
        courses: courses
      });
    } catch (error) {
      console.error('Courses fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch courses'
      });
    }
  });

  // Apply global API rate limiting (non-admin routes)
  app.use('/api/public', apiRateLimit);

  // Login endpoint - authenticate user and return user data
  app.post('/api/login', authRateLimit, async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const users = await storage.getUsers();
      const user = users.find(u => u.email === email);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Support both bcrypt hash and plain text passwords (for backward compatibility)
      let passwordMatch = false;
      
      // Check if password is bcrypt hashed (starts with $2a$, $2b$, or $2y$)
      if (user.password.startsWith('$2')) {
        passwordMatch = await bcrypt.compare(password, user.password);
      } else {
        // Plain text password comparison
        passwordMatch = password === user.password;
      }
      
      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Block login for accounts that have not been approved by an admin/staff yet.
      // Strict check: anything other than 'active' (including null/undefined/empty string) is denied.
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          pending: true,
          message: 'Hesabınız henüz onaylanmadı. Yöneticilerimiz başvurunuzu inceledikten sonra giriş yapabileceksiniz.'
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
  app.post('/api/signup', authRateLimit, async (req, res) => {
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

      // Hash password before storing
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user — closed system: new agents start as INACTIVE and require admin/staff approval
      const newUser = {
        id: userId,
        username: email,
        password: hashedPassword,
        name: name,
        email: email,
        role: 'agent' as const,
        status: 'inactive' as const,
        agencyId: agencyId,
        emailNotifications: true,
        courseCompletionNotif: true,
        certificateNotif: true,
        announcementNotif: true
      };

      const createdAgency = await storage.createAgency(newAgency);
      const createdUser = await storage.createUser(newUser);

      // Send welcome email to new agent (non-blocking)
      if (createdUser.emailNotifications) {
        (async () => {
          try {
            const { sendNotificationEmail } = await import('./emailService');
            await sendNotificationEmail({
              recipientEmail: createdUser.email,
              recipientName: createdUser.name,
              type: 'welcome',
              data: {
                agencyName: createdAgency.name
              }
            });
          } catch (err) {
            console.error('Welcome email error:', err);
          }
        })();
      }
      
      // Send notification to all admins about new registration (non-blocking)
      (async () => {
        try {
          const { sendSmtpEmail, generateAdminNewRegistrationEmail } = await import('./smtp-email');
          const users = await storage.getUsers();
          const admins = users.filter(u => u.role === 'admin' && u.emailNotifications);
          
          for (const admin of admins) {
            const emailContent = generateAdminNewRegistrationEmail(
              createdUser.name,
              createdUser.email,
              createdAgency.name
            );
            await sendSmtpEmail({
              to: admin.email,
              subject: emailContent.subject,
              html: emailContent.html
            });
          }
        } catch (err) {
          console.error('Admin notification email error:', err);
        }
      })();

      // Closed system — do NOT return a session/user. The applicant must wait for admin/staff approval.
      res.status(201).json({
        success: true,
        pending: true,
        message: 'Başvurunuz alındı. Hesabınız yöneticilerimiz tarafından onaylandıktan sonra giriş yapabileceksiniz.'
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Signup failed'
      });
    }
  });

  // Forgot password endpoint - generate reset token and send email
  app.post('/api/forgot-password', passwordResetRateLimit, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      // Always return success even if user not found (security best practice)
      if (!user) {
        return res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Token expires in 1 hour
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      
      // Save token to database
      await storage.setResetToken(user.id, resetToken, resetTokenExpiry);
      
      // Build reset URL
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
      
      // Send password reset email (non-blocking)
      (async () => {
        try {
          const { sendNotificationEmail } = await import('./emailService');
          await sendNotificationEmail({
            recipientEmail: user.email,
            recipientName: user.name,
            type: 'password_reset',
            data: {
              resetUrl
            }
          });
        } catch (err) {
          console.error('Password reset email error:', err);
        }
      })();

      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset request'
      });
    }
  });

  // Reset password endpoint - validate token and update password
  app.post('/api/reset-password', passwordResetRateLimit, async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Token and new password are required'
        });
      }

      // Validate password length
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Find user by reset token
      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Check if token is expired
      if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
        // Clear expired token
        await storage.clearResetToken(user.id);
        return res.status(400).json({
          success: false,
          message: 'Reset token has expired'
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      await storage.updateUser(user.id, { password: hashedPassword });
      
      // Clear reset token
      await storage.clearResetToken(user.id);

      res.json({
        success: true,
        message: 'Password has been reset successfully'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password'
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

      // Auto-generate certificate if this is a passing Final Exam attempt
      let generatedCertificate = null;
      let certificateAlreadyIssued = false;
      
      try {
        // Get quiz details to check if it's a final exam
        const quiz = await storage.getQuizById(quizId);
        
        if (quiz && quiz.isFinal && scorePercent >= quiz.passPercent) {
          // Check if certificate already exists for this user/course (fresh query)
          const existingCertificates = await storage.getCertificates();
          const existingCert = existingCertificates.find(c => 
            c.userId === authenticatedUser.id && c.courseId === quiz.courseId
          );
          
          if (!existingCert) {
            // Generate secure certificate code with retry mechanism and fresh uniqueness checks
            let attempts_count = 0;
            let certificateCode: string;
            
            do {
              certificateCode = generateSecureCertificateCode();
              attempts_count++;
              
              // Fresh check for uniqueness on each attempt to avoid race conditions
              const allCerts = await storage.getCertificates();
              const codeExists = allCerts.some(c => c.code === certificateCode);
              if (!codeExists) break;
              
              if (attempts_count >= 10) {
                throw new Error('Failed to generate unique certificate code');
              }
            } while (attempts_count < 10);

            // Create certificate in database with retry on code collision
            let certCreated = false;
            let certRetries = 0;
            
            while (!certCreated && certRetries < 5) {
              try {
                generatedCertificate = await storage.addCertificate({
                  userId: authenticatedUser.id,
                  courseId: quiz.courseId,
                  scorePercent: parseInt(scorePercent),
                  code: certificateCode
                });
                
                certCreated = true;
                console.log(`✅ Auto-generated certificate ${certificateCode} for user ${authenticatedUser.id} on Final Exam ${quizId}`);
                
                // Send certificate email to agent (non-blocking)
                const courses = await storage.getCourses();
                const course = courses.find(c => c.id === quiz.courseId);
                const courseName = course?.title || 'Course';
                
                if (authenticatedUser.certificateNotif && authenticatedUser.emailNotifications) {
                  (async () => {
                    try {
                      const { sendNotificationEmail } = await import('./emailService');
                      await sendNotificationEmail({
                        recipientEmail: authenticatedUser.email,
                        recipientName: authenticatedUser.name,
                        type: 'certificate',
                        data: {
                          courseName,
                          certificateUrl: `/certificates/${certificateCode}`
                        }
                      });
                    } catch (err) {
                      console.error('Certificate email error:', err);
                    }
                  })();
                }
                
                // Send notification to all admins about new certificate (non-blocking)
                (async () => {
                  try {
                    const { sendSmtpEmail, generateAdminCertificateEmail } = await import('./smtp-email');
                    const users = await storage.getUsers();
                    const admins = users.filter(u => u.role === 'admin' && u.emailNotifications);
                    
                    for (const admin of admins) {
                      const emailContent = generateAdminCertificateEmail(
                        authenticatedUser.name,
                        authenticatedUser.email,
                        courseName,
                        certificateCode
                      );
                      await sendSmtpEmail({
                        to: admin.email,
                        subject: emailContent.subject,
                        html: emailContent.html
                      });
                    }
                  } catch (err) {
                    console.error('Admin certificate notification error:', err);
                  }
                })();
              } catch (dbError: any) {
                const is23505 = dbError?.code === '23505';
                const hasUniqueError = dbError?.message?.toLowerCase().includes('unique') || dbError?.message?.toLowerCase().includes('duplicate');
                
                if (is23505 || hasUniqueError) {
                  // Check if it's user/course duplicate (already issued) or code collision
                  const errorDetail = dbError?.message || dbError?.detail || '';
                  
                  if (errorDetail.includes('user_course_unique') || errorDetail.includes('user_id') || errorDetail.includes('course_id')) {
                    // User/course duplicate - certificate already exists from concurrent request
                    console.log(`⚠️ Duplicate user/course certificate detected for user ${authenticatedUser.id} on course ${quiz.courseId}`);
                    const allCerts = await storage.getCertificates();
                    const existing = allCerts.find(c => 
                      c.userId === authenticatedUser.id && c.courseId === quiz.courseId
                    );
                    if (existing) {
                      certificateAlreadyIssued = true;
                      generatedCertificate = existing;
                      certCreated = true; // Exit loop
                    }
                    break;
                  } else {
                    // Code collision - generate new code and retry
                    console.log(`⚠️ Certificate code collision detected (${certificateCode}), generating new code...`);
                    certificateCode = generateSecureCertificateCode();
                    certRetries++;
                  }
                } else {
                  // Re-throw non-duplicate errors
                  throw dbError;
                }
              }
            }
            
            if (!certCreated && !generatedCertificate) {
              console.error(`❌ Failed to create certificate after ${certRetries} retries`);
            }
          } else {
            certificateAlreadyIssued = true;
            generatedCertificate = existingCert;
            console.log(`ℹ️ Certificate already exists for user ${authenticatedUser.id} on course ${quiz.courseId} - code: ${existingCert.code}`);
          }
        }
      } catch (certError) {
        // Log certificate generation error but don't fail the attempt submission
        console.error('Certificate auto-generation error:', certError);
      }

      res.status(201).json({
        success: true,
        attempt: {
          id: savedAttempt.id,
          scorePercent: savedAttempt.scorePercent,
          date: savedAttempt.date
        },
        certificate: generatedCertificate ? {
          id: generatedCertificate.id,
          code: generatedCertificate.code,
          scorePercent: generatedCertificate.scorePercent,
          issuedAt: generatedCertificate.issuedAt,
          alreadyIssued: certificateAlreadyIssued
        } : undefined
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
  // Get user's quiz attempts
  app.get('/api/attempts', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      
      // Get all attempts for the authenticated user
      const allAttempts = await storage.getAttempts();
      const userAttempts = allAttempts.filter(attempt => 
        attempt.userId === authenticatedUser.id
      );

      res.json({
        success: true,
        attempts: userAttempts
      });
    } catch (error) {
      console.error('Attempts retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve attempts'
      });
    }
  });

  app.get('/api/certificates', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      
      // Get all certificates for the authenticated user
      const allCertificates = await storage.getCertificates();
      const userCertificates = allCertificates.filter(cert => 
        cert.userId === authenticatedUser.id
      );

      // Enrich certificates with course and agency information
      const courses = await storage.getCourses();
      const agencies = await storage.getAgencies();
      const users = await storage.getUsers();
      
      const enrichedCertificates = userCertificates.map(cert => {
        const course = courses.find(c => c.id === cert.courseId);
        const user = users.find(u => u.id === cert.userId);
        const agency = user?.agencyId ? agencies.find(a => a.id === user.agencyId) : null;
        
        return {
          id: cert.id,
          code: cert.code,
          scorePercent: cert.scorePercent,
          issuedAt: cert.issuedAt,
          userId: cert.userId,
          courseId: cert.courseId,
          course: course ? {
            id: course.id,
            title: course.title,
            slug: course.slug
          } : null,
          agency: agency ? {
            id: agency.id,
            name: agency.name
          } : null
        };
      });

      res.json({
        success: true,
        certificates: enrichedCertificates
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

  // ==================== Progress Tracking Endpoints ====================
  
  // Get user's progress for all courses
  app.get('/api/progress', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      
      // Get all progresses for the authenticated user
      const userProgresses = await storage.getProgresses(authenticatedUser.id);
      
      // Enrich with course information
      const courses = await storage.getCourses();
      const enrichedProgresses = userProgresses.map(progress => {
        const course = courses.find(c => c.id === progress.courseId);
        return {
          ...progress,
          course: course ? {
            id: course.id,
            title: course.title,
            slug: course.slug
          } : null
        };
      });

      res.json({
        success: true,
        progresses: enrichedProgresses
      });
    } catch (error) {
      console.error('Progress retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during progress retrieval'
      });
    }
  });

  // Get user's progress for specific course
  app.get('/api/progress/:courseId', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { courseId } = req.params;

      const progress = await storage.getProgressByUserAndCourse(authenticatedUser.id, courseId);

      if (!progress) {
        return res.status(404).json({
          success: false,
          message: 'Progress not found for this course'
        });
      }

      // Enrich with course information
      const courses = await storage.getCourses();
      const course = courses.find(c => c.id === courseId);

      res.json({
        success: true,
        progress: {
          ...progress,
          course: course ? {
            id: course.id,
            title: course.title,
            slug: course.slug
          } : null
        }
      });
    } catch (error) {
      console.error('Course progress retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during course progress retrieval'
      });
    }
  });

  // Upsert user's progress (create or update)
  app.post('/api/progress', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { courseId, lessonCompletedIds, percent, currentLessonId } = req.body;

      // Validate required fields
      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: 'courseId is required'
        });
      }

      // Get existing progress to check if this is a new completion
      const existingProgress = await storage.getProgressByUserAndCourse(authenticatedUser.id, courseId);
      const wasNotCompleted = !existingProgress || existingProgress.percent < 100;
      
      // Upsert progress (creates or updates, merges with existing)
      const progress = await storage.upsertProgress({
        userId: authenticatedUser.id,
        courseId,
        lessonCompletedIds,
        percent,
        currentLessonId,
        lastLessonCompletedAt: lessonCompletedIds && lessonCompletedIds.length > 0 ? new Date() : undefined,
      });

      // Track newly completed lessons as analytics events (non-blocking)
      if (lessonCompletedIds && lessonCompletedIds.length > 0) {
        const prevIds = existingProgress?.lessonCompletedIds || [];
        const newlyCompleted = lessonCompletedIds.filter((id: string) => !prevIds.includes(id));
        for (const contentId of newlyCompleted) {
          storage.createAnalyticsMetric({
            userId: authenticatedUser.id,
            metricType: 'lesson_view',
            contentId,
            courseId,
            metricValue: JSON.stringify({ action: 'lesson_complete' }),
          }).catch(() => {});
        }
      }

      // Send course completion email (non-blocking) if just completed
      if (percent === 100 && wasNotCompleted && authenticatedUser.courseCompletionNotif && authenticatedUser.emailNotifications) {
        const courses = await storage.getCourses();
        const course = courses.find(c => c.id === courseId);
        if (course) {
          (async () => {
            try {
              const { sendNotificationEmail } = await import('./emailService');
              await sendNotificationEmail({
                recipientEmail: authenticatedUser.email,
                recipientName: authenticatedUser.name,
                type: 'course_completion',
                data: {
                  courseName: course.title
                }
              });
            } catch (err) {
              console.error('Course completion email error:', err);
            }
          })();
        }
      }

      res.status(200).json({
        success: true,
        progress
      });
    } catch (error) {
      console.error('Progress upsert error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during progress update'
      });
    }
  });

  // Partial update user's progress for specific course
  app.patch('/api/progress/:courseId', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { courseId } = req.params;
      const { lessonCompletedIds, percent, currentLessonId, lastLessonCompletedAt } = req.body;

      // Check if progress exists
      const existing = await storage.getProgressByUserAndCourse(authenticatedUser.id, courseId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Progress not found for this course. Use POST /api/progress to create it first.'
        });
      }

      // Partial update - only update provided fields
      const updates: any = {};
      if (lessonCompletedIds !== undefined) updates.lessonCompletedIds = lessonCompletedIds;
      if (percent !== undefined) updates.percent = percent;
      if (currentLessonId !== undefined) updates.currentLessonId = currentLessonId;
      if (lastLessonCompletedAt !== undefined) updates.lastLessonCompletedAt = lastLessonCompletedAt;

      const progress = await storage.updateProgress(authenticatedUser.id, courseId, updates);

      res.json({
        success: true,
        progress
      });
    } catch (error) {
      console.error('Progress update error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during progress update'
      });
    }
  });

  // Get current user's learning activity for last 7 days (for dashboard chart)
  app.get('/api/analytics/my-activity', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const metrics = await storage.getUserMetricsInDateRange(
        authenticatedUser.id,
        sevenDaysAgo,
        now
      );

      // Build last 7 days array
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(now.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const count = metrics.filter(m => {
          if (m.metricType !== 'lesson_view') return false;
          const mDate = new Date(m.timestamp).toISOString().split('T')[0];
          return mDate === dateStr;
        }).length;
        return { day: dayName, date: dateStr, lessons: count };
      });

      res.json({ success: true, activity: days });
    } catch (error) {
      console.error('Activity fetch error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch activity' });
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
      const { role, name, email, status, companyName, agencyId, languagePreference } = req.body;

      // Validate role if provided
      if (role && !['admin', 'agent', 'staff'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be admin, agent, or staff.'
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
      if (status !== undefined) updates.status = status;
      if (companyName !== undefined) updates.companyName = companyName;
      if (agencyId !== undefined) updates.agencyId = agencyId;
      if (languagePreference !== undefined) updates.languagePreference = languagePreference;

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

  // Create new user (admin only)
  app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username, password, name, email, role, status, country, profilePicture, companyName } = req.body;

      // Validate required fields
      if (!username || !password || !name || !email) {
        return res.status(400).json({
          success: false,
          message: 'Username, password, name, and email are required'
        });
      }

      // Validate role
      if (role && !['admin', 'agent', 'staff'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be admin, agent, or staff.'
        });
      }

      // Check if username or email already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        name,
        email,
        role: role || 'agent'
      });

      // Apply optional fields not on insertUserSchema (status, country, profilePicture, companyName)
      const optionalUpdates: Partial<typeof newUser> = {};
      if (status) optionalUpdates.status = status;
      if (typeof country === 'string' && country.trim()) optionalUpdates.country = country.trim().toUpperCase();
      if (typeof profilePicture === 'string' && profilePicture.trim()) optionalUpdates.profilePicture = profilePicture.trim();
      if (typeof companyName === 'string' && companyName.trim()) optionalUpdates.companyName = companyName.trim();
      if (Object.keys(optionalUpdates).length > 0) {
        await storage.updateUser(newUser.id, optionalUpdates);
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = newUser;

      res.json({
        success: true,
        user: userWithoutPassword
      });
    } catch (error: any) {
      console.error('Create user error:', error);
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Failed to create user'
      });
    }
  });

  // Delete user (admin only)
  app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Check if user exists
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Prevent deleting yourself
      if (id === (req as any).user?.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      await storage.deleteUser(id);

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    }
  });

  // Bulk update user status (admin only)
  app.post('/api/admin/users/bulk-status', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userIds, status } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'userIds must be a non-empty array'
        });
      }

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be active or inactive.'
        });
      }

      // Update each user
      const updatePromises = userIds.map(id => storage.updateUser(id, { status }));
      await Promise.all(updatePromises);

      res.json({
        success: true,
        message: `${userIds.length} user(s) status updated to ${status}`
      });
    } catch (error) {
      console.error('Bulk status update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user statuses'
      });
    }
  });

  // Bulk delete users (admin only)
  app.post('/api/admin/users/bulk-delete', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'userIds must be a non-empty array'
        });
      }

      // Prevent deleting yourself
      if (userIds.includes((req as any).user?.id)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      // Delete each user
      const deletePromises = userIds.map(id => storage.deleteUser(id));
      await Promise.all(deletePromises);

      res.json({
        success: true,
        message: `${userIds.length} user(s) deleted successfully`
      });
    } catch (error) {
      console.error('Bulk delete error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete users'
      });
    }
  });

  // Bulk import users from Excel/CSV upload
  app.post('/api/admin/users/bulk-import', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { users: rawUsers } = req.body;

      if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
        return res.status(400).json({ success: false, message: 'users array is required' });
      }

      if (rawUsers.length > 500) {
        return res.status(400).json({ success: false, message: 'Maximum 500 users per import' });
      }

      const results: { row: number; email: string; status: 'success' | 'error'; message?: string }[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < rawUsers.length; i++) {
        const row = rawUsers[i];
        const rowNum = i + 2; // Excel row (1-indexed header + 1)

        // Basic validation
        if (!row.email || !row.name || !row.username || !row.password) {
          results.push({ row: rowNum, email: row.email || '(missing)', status: 'error', message: 'name, email, username, and password are required' });
          errorCount++;
          continue;
        }

        // Check email uniqueness
        const existing = await storage.getUserByEmail(row.email);
        if (existing) {
          results.push({ row: rowNum, email: row.email, status: 'error', message: 'Email already exists' });
          errorCount++;
          continue;
        }

        // Check username uniqueness
        const existingUsername = await storage.getUserByUsername(row.username);
        if (existingUsername) {
          results.push({ row: rowNum, email: row.email, status: 'error', message: 'Username already exists' });
          errorCount++;
          continue;
        }

        try {
          // Validate optional fields BEFORE creating the user so we don't leave orphans
          const optionalUpdates: Record<string, any> = {};
          optionalUpdates.status = row.status === 'inactive' ? 'inactive' : 'active';
          if (typeof row.companyName === 'string' && row.companyName.trim()) {
            optionalUpdates.companyName = row.companyName.trim();
          }
          if (typeof row.country === 'string' && row.country.trim()) {
            const normalizedCountry = row.country.trim().toUpperCase();
            if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
              results.push({ row: rowNum, email: row.email, status: 'error', message: 'country must be a 2-letter ISO 3166-1 alpha-2 code (e.g. TR, US)' });
              errorCount++;
              continue;
            }
            optionalUpdates.country = normalizedCountry;
          }
          if (typeof row.profilePicture === 'string' && row.profilePicture.trim()) {
            const pp = row.profilePicture.trim();
            const isValidPicture = /^https?:\/\//i.test(pp) || pp.startsWith('/uploads/');
            if (!isValidPicture) {
              results.push({ row: rowNum, email: row.email, status: 'error', message: 'profilePicture must be an http(s) URL or a /uploads/... path' });
              errorCount++;
              continue;
            }
            optionalUpdates.profilePicture = pp;
          }

          const hashedPassword = await bcrypt.hash(row.password, 10);
          const newUser = await storage.createUser({
            username: row.username.trim(),
            password: hashedPassword,
            name: row.name.trim(),
            email: row.email.trim().toLowerCase(),
            role: ['admin', 'agent', 'staff'].includes(row.role) ? row.role : 'agent',
          });
          if (Object.keys(optionalUpdates).length > 0) {
            try {
              await storage.updateUser(newUser.id, optionalUpdates);
            } catch (updateErr) {
              // Compensating delete so the row is reported accurately and can be retried
              try { await storage.deleteUser(newUser.id); } catch {}
              throw updateErr;
            }
          }
          results.push({ row: rowNum, email: row.email, status: 'success' });
          successCount++;
        } catch (err: any) {
          results.push({ row: rowNum, email: row.email, status: 'error', message: err.message || 'Failed to create user' });
          errorCount++;
        }
      }

      res.json({
        success: true,
        successCount,
        errorCount,
        total: rawUsers.length,
        results,
      });
    } catch (error: any) {
      console.error('Bulk import error:', error);
      res.status(500).json({ success: false, message: 'Bulk import failed' });
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

      // Send announcement email to all users if published (non-blocking)
      if (status === 'published') {
        const users = await storage.getUsers();
        const eligibleUsers = users.filter(u => {
          // Check if user should receive this announcement based on targetAudience
          if (targetAudience === 'admins' && u.role !== 'admin') return false;
          if (targetAudience === 'agents' && u.role !== 'agent') return false;
          // Check notification preferences
          return u.announcementNotif && u.emailNotifications && u.email;
        });

        // Send emails to all eligible users
        if (eligibleUsers.length > 0) {
          (async () => {
            try {
              const { sendNotificationEmail } = await import('./emailService');
              for (const user of eligibleUsers) {
                try {
                  await sendNotificationEmail({
                    recipientEmail: user.email,
                    recipientName: user.name,
                    type: 'announcement',
                    data: {
                      title,
                      content
                    }
                  });
                } catch (err) {
                  console.error(`Announcement email error for ${user.email}:`, err);
                }
              }
            } catch (err) {
              console.error('Failed to load emailService module:', err);
            }
          })();
        }
      }

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

  // Public announcements endpoint - shown on the public landing page (top N "all" published)
  app.get('/api/announcements/public', async (req, res) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || '3', 10) || 3, 10);
      const all = await storage.getAnnouncements();
      const filtered = all.filter(a => {
        const isPublished = a.status === 'published';
        const isAll = a.targetAudience === 'all';
        const notExpired = !a.expiresAt || new Date(a.expiresAt) > new Date();
        return isPublished && isAll && notExpired;
      });
      res.json({ success: true, announcements: filtered.slice(0, limit) });
    } catch (error) {
      console.error('Public announcements error:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve announcements' });
    }
  });

  // ==================== POPUPS (Pop-up Reklamlar) ====================
  // Admin: list all popups
  app.get('/api/admin/popups', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const popups = await storage.getPopups();
      res.json({ success: true, popups });
    } catch (error) {
      console.error('List popups error:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve popups' });
    }
  });

  // Admin: create popup
  app.post('/api/admin/popups', requireAuth, requireAdmin, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { 
        title, content, imageUrl, linkUrl, linkText,
        targetAudience, targetAgencyIds, status,
        startsAt, expiresAt, frequency,
      } = req.body;
      if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Title and content are required' });
      }
      const popup = await storage.createPopup({
        title,
        content,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        linkText: linkText || null,
        targetAudience: targetAudience || 'all',
        targetAgencyIds: Array.isArray(targetAgencyIds) ? targetAgencyIds : null,
        status: status || 'draft',
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        frequency: frequency || 'every_session',
        createdBy: authenticatedUser.id,
      });
      res.json({ success: true, popup });
    } catch (error) {
      console.error('Create popup error:', error);
      res.status(500).json({ success: false, message: 'Failed to create popup' });
    }
  });

  // Admin: update popup
  app.put('/api/admin/popups/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getPopupById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Popup not found' });
      const allowed = ['title','content','imageUrl','linkUrl','linkText','targetAudience','targetAgencyIds','status','frequency'];
      const updates: any = {};
      for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
      if (req.body.startsAt !== undefined) updates.startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
      if (req.body.expiresAt !== undefined) updates.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
      const popup = await storage.updatePopup(id, updates);
      res.json({ success: true, popup });
    } catch (error) {
      console.error('Update popup error:', error);
      res.status(500).json({ success: false, message: 'Failed to update popup' });
    }
  });

  // Admin: delete popup
  app.delete('/api/admin/popups/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getPopupById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Popup not found' });
      await storage.deletePopup(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete popup error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete popup' });
    }
  });

  // Authenticated user: get active popups visible to them, applying frequency rules
  app.get('/api/popups/active', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const active = await storage.getActivePopupsForUser(
        authenticatedUser.id,
        authenticatedUser.agencyId,
        authenticatedUser.role,
      );
      const dismissals = await storage.getUserDismissals(authenticatedUser.id);
      const dismissalMap = new Map(dismissals.map(d => [d.popupId, d]));

      const visible = active.filter(p => {
        const d = dismissalMap.get(p.id);
        if (!d) return true;
        // Once-per-user: any dismissal hides forever
        if (p.frequency === 'once_per_user') return false;
        // Every-login: hidden if dismissed since the user's last login (we
        // approximate "this login" by the client clearing its session storage
        // on next login. Server-side, we treat dontShowAgain as a hard block.)
        if (d.dontShowAgain) return false;
        // every_session and every_login both rely on the client to enforce
        // per-session/per-login visibility via local storage.
        return true;
      });

      res.json({ success: true, popups: visible });
    } catch (error) {
      console.error('Active popups error:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve popups' });
    }
  });

  // Authenticated user: dismiss popup
  app.post('/api/popups/:id/dismiss', requireAuth, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { id } = req.params;
      const dontShowAgain = !!req.body?.dontShowAgain;
      const existing = await storage.getPopupById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Popup not found' });
      await storage.upsertPopupDismissal({
        popupId: id,
        userId: authenticatedUser.id,
        dontShowAgain,
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Dismiss popup error:', error);
      res.status(500).json({ success: false, message: 'Failed to dismiss popup' });
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

  // Upload profile picture (local file system)
  app.post('/api/profile-picture/upload', requireAuth, profilePictureUpload.single('file'), async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }
      
      // File path relative to public folder
      const fileUrl = `/uploads/profiles/${req.file.filename}`;
      
      // Update user profile picture URL in database
      await storage.updateUser(userId, { profilePicture: fileUrl });
      
      console.log('[PROFILE PICTURE UPDATE] Success:', {
        userId,
        profilePictureURL: fileUrl
      });
      
      res.json({
        success: true,
        url: fileUrl,
        message: 'Profile picture uploaded successfully'
      });
    } catch (error) {
      console.error('Profile picture upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload profile picture'
      });
    }
  });

  // Upload agency logo (local file system)
  app.post('/api/agency-logo/upload', requireAuth, agencyLogoUpload.single('file'), async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const requestedAgencyId = req.body.agencyId;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }
      
      if (!requestedAgencyId) {
        return res.status(400).json({
          success: false,
          message: 'agencyId is required'
        });
      }
      
      // Authorization: Verify the user owns this agency
      // Agents can only upload logos for their own agency
      // Admins can upload for any agency
      if (authenticatedUser.role === 'agent') {
        if (authenticatedUser.agencyId !== requestedAgencyId) {
          return res.status(403).json({
            success: false,
            message: 'You can only upload logos for your own agency'
          });
        }
      }
      // Admins can upload for any agency (no additional check needed)
      
      // File path relative to public folder
      const logoUrl = `/uploads/logos/${req.file.filename}`;
      
      // Update agency logo URL in database
      await storage.updateAgency(requestedAgencyId, { logoUrl: logoUrl });
      
      console.log('[AGENCY LOGO UPDATE] Success:', {
        agencyId: requestedAgencyId,
        logoUrl,
        uploadedBy: authenticatedUser.id
      });
      
      res.json({
        success: true,
        url: logoUrl,
        message: 'Agency logo uploaded successfully'
      });
    } catch (error) {
      console.error('Agency logo upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload agency logo'
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

  // Admin or Staff middleware (operational roles)
  async function requireAdminOrStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user || !['admin', 'staff'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin or Staff access required'
        });
      }
      next();
    } catch (error) {
      res.status(403).json({ success: false, message: 'Authorization failed' });
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

  // Bulk update agency status (admin only)
  app.post('/api/admin/agencies/bulk-status', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { agencyIds, status } = req.body;

      if (!Array.isArray(agencyIds) || agencyIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'agencyIds must be a non-empty array'
        });
      }

      if (!['active', 'inactive', 'pending'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be active, inactive, or pending.'
        });
      }

      // Update each agency
      const updatePromises = agencyIds.map(id => storage.updateAgency(id, { status }));
      await Promise.all(updatePromises);

      res.json({
        success: true,
        message: `${agencyIds.length} agency(ies) status updated to ${status}`
      });
    } catch (error) {
      console.error('Bulk status update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update agency statuses'
      });
    }
  });

  // Bulk delete agencies (admin only)
  app.post('/api/admin/agencies/bulk-delete', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { agencyIds } = req.body;

      if (!Array.isArray(agencyIds) || agencyIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'agencyIds must be a non-empty array'
        });
      }

      // Delete each agency
      const deletePromises = agencyIds.map(id => storage.deleteAgency(id));
      await Promise.all(deletePromises);

      res.json({
        success: true,
        message: `${agencyIds.length} agency(ies) deleted successfully`
      });
    } catch (error) {
      console.error('Bulk delete error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete agencies'
      });
    }
  });

  // Bulk import agencies
  app.post('/api/admin/agencies/bulk-import', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { agencies: rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, message: 'agencies must be a non-empty array' });
      }
      const created: any[] = [];
      const errors: { row: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const validation = insertAgencySchema.safeParse({
          name: row.name || row.Name || row['Agency Name'],
          country: row.country || row.Country || null,
          city: row.city || row.City || null,
          contactEmail: row.contactEmail || row.email || row.Email || row['Contact Email'] || null,
          contactPhone: row.contactPhone || row.phone || row.Phone || row['Contact Phone'] || null,
          website: row.website || row.Website || null,
          description: row.description || row.Description || null,
          primaryContactName: row.primaryContactName || row['Primary Contact'] || null,
          primaryContactEmail: row.primaryContactEmail || row['Primary Contact Email'] || null,
          staffSize: row.staffSize ? parseInt(row.staffSize) : null,
          annualStudents: row.annualStudents ? parseInt(row.annualStudents) : null,
          status: (['active', 'inactive', 'pending'].includes(row.status || row.Status)) ? (row.status || row.Status) : 'pending',
        });
        if (!validation.success) {
          errors.push({ row: i + 1, message: `Row ${i + 1}: ${validation.error.errors.map(e => e.message).join(', ')}` });
          continue;
        }
        try {
          const agency = await storage.createAgency(validation.data);
          created.push(agency);
        } catch (err: any) {
          errors.push({ row: i + 1, message: `Row ${i + 1}: ${err.message}` });
        }
      }
      res.json({ success: true, created: created.length, errors, message: `${created.length} agencies imported, ${errors.length} failed` });
    } catch (error: any) {
      console.error('Bulk import agencies error:', error);
      res.status(500).json({ success: false, message: 'Failed to import agencies' });
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

  // ── Partner Folder routes ─────────────────────────────────────────────────

  // Helper: parse `parentId` query into the storage parameter contract.
  // - missing  → undefined (return ALL folders, used for client-side flat ops)
  // - "root" / "" / "null" → null (root-level folders only)
  // - any other string → that folder id
  const parseParentId = (raw: unknown): string | null | undefined => {
    if (raw === undefined) return undefined;
    if (typeof raw !== 'string') return undefined;
    if (raw === '' || raw === 'root' || raw === 'null') return null;
    return raw;
  };

  // Public: list published folders (for agents) — supports ?parentId=
  app.get('/api/partner-folders', requireAuth, async (req, res) => {
    try {
      const parentId = parseParentId(req.query.parentId);
      const folders = await storage.getPartnerFolders(parentId);
      const published = folders.filter(f => f.status === 'published');
      // Attach subfolder + content counts so the agent UI can show "X klasör · Y dosya"
      const foldersWithCounts = await Promise.all(published.map(async folder => {
        const counts = await storage.countFolderChildren(folder.id);
        return { ...folder, subfolderCount: counts.subfolders, contentCount: counts.contents };
      }));
      res.json({ success: true, folders: foldersWithCounts });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch folders' });
    }
  });

  // Public: get contents of a published folder (for agents) + subfolders + breadcrumbs
  app.get('/api/partner-folders/:id/contents', requireAuth, async (req, res) => {
    try {
      const folder = await storage.getPartnerFolderById(req.params.id);
      if (!folder || folder.status !== 'published') {
        return res.status(404).json({ success: false, message: 'Folder not found' });
      }
      const [items, subfolders, breadcrumb] = await Promise.all([
        storage.getFolderContents(req.params.id),
        storage.getPartnerFolders(req.params.id),
        storage.getFolderPath(req.params.id),
      ]);
      const publishedItems = items.filter(c => c.status === 'published');
      const publishedSub = await Promise.all(
        subfolders
          .filter(f => f.status === 'published')
          .map(async f => {
            const counts = await storage.countFolderChildren(f.id);
            return { ...f, subfolderCount: counts.subfolders, contentCount: counts.contents };
          })
      );
      res.json({ success: true, folder, contents: publishedItems, subfolders: publishedSub, breadcrumb });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch folder contents' });
    }
  });

  // Admin: list folders — supports ?parentId= (root by default if explicitly 'root')
  app.get('/api/admin/partner-folders', requireAuth, requireAdmin, async (req, res) => {
    try {
      const parentId = parseParentId(req.query.parentId);
      const folders = await storage.getPartnerFolders(parentId);
      // Attach subfolder + content counts for cards
      const foldersWithCounts = await Promise.all(folders.map(async folder => {
        const counts = await storage.countFolderChildren(folder.id);
        return { ...folder, subfolderCount: counts.subfolders, contentCount: counts.contents };
      }));
      res.json({ success: true, folders: foldersWithCounts });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch folders' });
    }
  });

  // Admin: get single folder with its contents + subfolders + breadcrumbs
  app.get('/api/admin/partner-folders/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const folder = await storage.getPartnerFolderById(req.params.id);
      if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });
      const [items, subfolders, breadcrumb] = await Promise.all([
        storage.getFolderContents(req.params.id),
        storage.getPartnerFolders(req.params.id),
        storage.getFolderPath(req.params.id),
      ]);
      const subWithCounts = await Promise.all(subfolders.map(async f => {
        const counts = await storage.countFolderChildren(f.id);
        return { ...f, subfolderCount: counts.subfolders, contentCount: counts.contents };
      }));
      res.json({ success: true, folder, contents: items, subfolders: subWithCounts, breadcrumb });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch folder' });
    }
  });

  // Admin: create folder — accepts optional parentFolderId
  app.post('/api/admin/partner-folders', requireAuth, requireAdmin, async (req, res) => {
    try {
      const folder = await storage.createPartnerFolder(req.body);
      res.json({ success: true, folder });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create folder' });
    }
  });

  // Admin: update folder — accepts optional parentFolderId (move folder)
  app.patch('/api/admin/partner-folders/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      // Prevent setting a folder as its own parent or as descendant of itself
      if (req.body.parentFolderId) {
        if (req.body.parentFolderId === req.params.id) {
          return res.status(400).json({ success: false, message: 'Bir klasör kendisinin alt klasörü olamaz' });
        }
        const ancestors = await storage.getFolderPath(req.body.parentFolderId);
        if (ancestors.some(a => a.id === req.params.id)) {
          return res.status(400).json({ success: false, message: 'Klasör kendi alt klasörünün altına taşınamaz' });
        }
      }
      const folder = await storage.updatePartnerFolder(req.params.id, req.body);
      res.json({ success: true, folder });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update folder' });
    }
  });

  // Admin: delete folder — fails when folder still has subfolders or contents
  app.delete('/api/admin/partner-folders/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deletePartnerFolder(req.params.id);
      res.json({ success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to delete folder';
      // Storage throws a Turkish, user-facing message when the folder isn't empty
      const status = msg.startsWith('Klasör boş değil') ? 409 : 500;
      res.status(status).json({ success: false, message: msg });
    }
  });

  // Admin: one-shot job — downsize legacy partner folder cover images that were
  // uploaded BEFORE server-side 540x540 resize was introduced. Iterates every
  // partner_folders.cover_image_url, resizes (fit:'inside', no enlargement) and
  // overwrites the original file in place so URLs stay valid. SVGs and remote
  // URLs are skipped. Idempotent — files already <=540px on both sides are skipped.
  app.post('/api/admin/partner-folders/resize-covers', requireAuth, requireAdmin, async (req, res) => {
    const report = {
      total: 0,
      resized: 0,
      skippedAlreadySmall: 0,
      skippedSvg: 0,
      skippedMissing: 0,
      skippedRemote: 0,
      errors: 0,
      bytesBefore: 0,
      bytesAfter: 0,
      details: [] as Array<{ folderId: string; url: string; status: string; before?: number; after?: number; error?: string }>,
    };
    // Hard-anchor allowed root for path safety: must always live under public/uploads/
    const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads');
    try {
      const folders = await storage.getPartnerFolders(); // undefined → all folders flat
      const withCovers = folders.filter(f => f.coverImageUrl && f.coverImageUrl.trim().length > 0);
      report.total = withCovers.length;

      for (const folder of withCovers) {
        const url = folder.coverImageUrl as string;
        // Only handle locally-served uploads. Anything else (http(s)://, data:, etc.) is skipped.
        if (!url.startsWith('/uploads/')) {
          report.skippedRemote++;
          report.details.push({ folderId: folder.id, url, status: 'skipped-remote' });
          continue;
        }
        // Resolve to disk path under public/, then ensure the resolved path stays
        // inside uploadsRoot (defends against path-traversal via crafted DB values).
        const relative = url.replace(/^\/+/, ''); // strip leading slash → uploads/content/images/foo.jpg
        const diskPath = path.resolve(process.cwd(), 'public', relative);
        if (!diskPath.startsWith(uploadsRoot + path.sep)) {
          report.skippedRemote++;
          report.details.push({ folderId: folder.id, url, status: 'skipped-outside-uploads' });
          continue;
        }

        if (!fs.existsSync(diskPath)) {
          report.skippedMissing++;
          report.details.push({ folderId: folder.id, url, status: 'missing' });
          continue;
        }

        // Skip SVGs — sharp can't safely raster-resize them without rasterise option.
        if (/\.svg$/i.test(diskPath)) {
          report.skippedSvg++;
          report.details.push({ folderId: folder.id, url, status: 'skipped-svg' });
          continue;
        }

        try {
          const before = fs.statSync(diskPath).size;
          report.bytesBefore += before;
          const original = await fs.promises.readFile(diskPath);
          const meta = await sharp(original).metadata();
          const w = meta.width ?? 0;
          const h = meta.height ?? 0;

          // Already within target — leave it alone (idempotent reruns are cheap).
          if (w > 0 && h > 0 && w <= 540 && h <= 540) {
            report.skippedAlreadySmall++;
            report.bytesAfter += before;
            report.details.push({ folderId: folder.id, url, status: 'already-small', before, after: before });
            continue;
          }

          const resized = await sharp(original)
            .rotate() // honour EXIF orientation
            .resize({ width: 540, height: 540, fit: 'inside', withoutEnlargement: true })
            .toBuffer();
          await fs.promises.writeFile(diskPath, resized);
          const after = resized.length;
          report.bytesAfter += after;
          report.resized++;
          report.details.push({ folderId: folder.id, url, status: 'resized', before, after });
        } catch (err) {
          report.errors++;
          const msg = err instanceof Error ? err.message : 'resize failed';
          report.bytesAfter += fs.existsSync(diskPath) ? fs.statSync(diskPath).size : 0;
          report.details.push({ folderId: folder.id, url, status: 'error', error: msg });
          console.warn(`[resize-covers] Failed for folder ${folder.id} (${url}):`, err);
        }
      }

      const savedBytes = report.bytesBefore - report.bytesAfter;
      const savedMB = (savedBytes / (1024 * 1024)).toFixed(2);
      console.log(
        `[resize-covers] Done. total=${report.total} resized=${report.resized} ` +
        `already-small=${report.skippedAlreadySmall} svg=${report.skippedSvg} ` +
        `missing=${report.skippedMissing} remote=${report.skippedRemote} errors=${report.errors} ` +
        `saved=${savedMB} MB (before=${(report.bytesBefore / 1024 / 1024).toFixed(2)} MB, after=${(report.bytesAfter / 1024 / 1024).toFixed(2)} MB)`
      );
      // Full per-folder details are kept in server logs; only error rows are
      // returned to the client to keep payloads small on large datasets.
      const errorDetails = report.details.filter(d => d.status === 'error' || d.status === 'missing');
      if (report.details.length > 0) {
        console.log('[resize-covers] Per-folder details:', JSON.stringify(report.details));
      }

      res.json({
        success: true,
        summary: {
          total: report.total,
          resized: report.resized,
          skippedAlreadySmall: report.skippedAlreadySmall,
          skippedSvg: report.skippedSvg,
          skippedMissing: report.skippedMissing,
          skippedRemote: report.skippedRemote,
          errors: report.errors,
          bytesBefore: report.bytesBefore,
          bytesAfter: report.bytesAfter,
          bytesSaved: savedBytes,
          mbSaved: savedMB,
        },
        // Only error/missing rows surface to the client; full report stays in server logs.
        errorDetails,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Resize job failed';
      console.error('[resize-covers] Fatal error:', error);
      res.status(500).json({ success: false, message: msg, partialReport: report });
    }
  });

  // Admin: assign content to a folder (or unassign by passing folderId: null)
  app.patch('/api/admin/contents/:id/folder', requireAuth, requireAdmin, async (req, res) => {
    try {
      const folderIdSchema = z.object({ folderId: z.string().nullable() });
      const { folderId } = folderIdSchema.parse(req.body);
      const content = await storage.updateContent(req.params.id, { folderId });
      res.json({ success: true, content });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to assign content to folder';
      res.status(500).json({ success: false, message: msg });
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

      // Merge existing quiz with update data to validate final state
      const mergedQuiz = {
        ...existingQuiz,
        ...validation.data
      };

      // Validate: Final Exams must have a country
      if (mergedQuiz.isFinal && !mergedQuiz.countryId) {
        return res.status(400).json({
          success: false,
          message: 'Country is required for Final Exams',
          errors: [{
            path: ['countryId'],
            message: 'Country is required for Final Exams'
          }]
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

  // ---- Integration Event Log ----
  app.get('/api/admin/integration-events', requireAdminOrStaff, async (req, res) => {
    try {
      const { integration_id, event_type, status, limit } = req.query;
      const events = await storage.getIntegrationEvents({
        integrationId: integration_id as string | undefined,
        eventType: event_type as string | undefined,
        status: status as string | undefined,
        limit: limit ? parseInt(limit as string) : 200,
      });
      res.json({ success: true, events });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Manual webhook trigger (for testing)
  app.post('/api/admin/integration-events/trigger', requireAdminOrStaff, async (req, res) => {
    try {
      const { integrationId, eventType, payload } = req.body;
      if (!integrationId || !eventType) {
        return res.status(400).json({ success: false, message: 'integrationId and eventType are required' });
      }

      const integration = await storage.getIntegrationById(integrationId);
      if (!integration) {
        return res.status(404).json({ success: false, message: 'Integration not found' });
      }

      if (!integration.endpointUrl) {
        return res.status(400).json({ success: false, message: 'Integration has no endpoint URL configured' });
      }

      const user = (req as any).user;
      const requestPayload = payload || { event: eventType, timestamp: new Date().toISOString(), test: true };
      const payloadStr = JSON.stringify(requestPayload);

      // Generate HMAC signature if webhook secret is set
      let hmacHeader: string | undefined;
      if (integration.webhookSecret) {
        const crypto = await import('crypto');
        const sig = crypto.createHmac('sha256', integration.webhookSecret)
          .update(payloadStr)
          .digest('hex');
        hmacHeader = `sha256=${sig}`;
      }

      // Create event log entry
      const event = await storage.createIntegrationEvent({
        integrationId: integration.id,
        integrationName: integration.name,
        eventType,
        method: 'POST',
        targetUrl: integration.endpointUrl,
        requestPayload: payloadStr,
        hmacHeader: hmacHeader || null,
        status: 'pending',
        triggeredBy: user?.id || 'system',
      });

      // Make the webhook call
      const startTime = Date.now();
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (hmacHeader) headers['X-Hub-Signature-256'] = hmacHeader;
        if (integration.apiKey) headers['X-API-Key'] = integration.apiKey;

        const response = await fetch(integration.endpointUrl, {
          method: 'POST',
          headers,
          body: payloadStr,
          signal: AbortSignal.timeout(15000),
        });

        const responseText = await response.text().catch(() => '');
        const durationMs = Date.now() - startTime;
        const isSuccess = response.status >= 200 && response.status < 300;

        const updated = await storage.updateIntegrationEventStatus(
          event.id,
          isSuccess ? 'success' : 'failed',
          response.status,
          responseText.slice(0, 2000),
          durationMs,
          isSuccess ? undefined : `HTTP ${response.status}`
        );

        res.json({ success: true, event: updated });
      } catch (fetchError: any) {
        const durationMs = Date.now() - startTime;
        const updated = await storage.updateIntegrationEventStatus(
          event.id, 'failed', undefined, undefined, durationMs,
          fetchError.message
        );
        res.json({ success: false, event: updated, message: fetchError.message });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ---- Integration API Keys ----
  app.get('/api/admin/integration-api-keys', requireAdminOrStaff, async (req, res) => {
    try {
      const includeRevoked = req.query.include_revoked === 'true';
      const keys = await storage.getIntegrationApiKeys(includeRevoked);
      res.json({ success: true, keys });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/integration-api-keys', requireAdminOrStaff, async (req, res) => {
    try {
      const { name, scopes, integrationId, expiresAt } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'name is required' });

      const crypto = await import('crypto');
      const user = (req as any).user;

      // Generate a secure random key: fas_<32 random bytes hex>
      const rawKey = `fas_${crypto.randomBytes(20).toString('hex')}`;
      const keyPrefix = rawKey.slice(0, 12); // "fas_" + 8 chars
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      const key = await storage.createIntegrationApiKey({
        name,
        keyPrefix,
        keyHash,
        scopes: scopes || null,
        integrationId: integrationId || null,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: user?.id || 'system',
        lastUsedAt: null,
        revokedAt: null,
        revokedBy: null,
      });

      // Return the full key only once (never stored)
      res.status(201).json({ success: true, key, rawKey });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/admin/integration-api-keys/:id', requireAdminOrStaff, async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const key = await storage.revokeIntegrationApiKey(id, user?.id || 'system');
      res.json({ success: true, key });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
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

  // Email notification endpoints
  app.post('/api/admin/send-test-email', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { to, type, data } = req.body;

      if (!to) {
        return res.status(400).json({
          success: false,
          message: 'Recipient email is required'
        });
      }

      const { sendNotificationEmail } = await import('./emailService');
      
      const result = await sendNotificationEmail({
        recipientEmail: to,
        recipientName: data?.name || 'Test User',
        type: type || 'welcome',
        data
      });

      if (result) {
        res.json({
          success: true,
          message: 'Test email sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send test email'
        });
      }
    } catch (error) {
      console.error('Send test email error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test email'
      });
    }
  });

  app.post('/api/send-certificate-email', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId, certificateId } = req.body;

      if (!userId || !certificateId) {
        return res.status(400).json({
          success: false,
          message: 'User ID and Certificate ID are required'
        });
      }

      const users = await storage.getUsers();
      const user = users.find(u => u.id === userId);

      if (!user || !user.email) {
        return res.status(404).json({
          success: false,
          message: 'User not found or email not available'
        });
      }

      const certificates = await storage.getCertificates();
      const certificate = certificates.find(c => c.id === certificateId);

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message: 'Certificate not found'
        });
      }

      // Get course information
      const courses = await storage.getCourses();
      const course = courses.find(c => c.id === certificate.courseId);
      const courseName = course?.title || 'Course';

      const { sendNotificationEmail } = await import('./emailService');
      
      const result = await sendNotificationEmail({
        recipientEmail: user.email,
        recipientName: user.name,
        type: 'certificate',
        data: {
          courseName,
          certificateUrl: `/certificates/${certificate.code}`
        }
      });

      if (result) {
        res.json({
          success: true,
          message: 'Certificate email sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send certificate email'
        });
      }
    } catch (error) {
      console.error('Send certificate email error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send certificate email'
      });
    }
  });

  // ---- Bulk Content Import ----
  app.get('/api/admin/content/bulk-template', requireAdminOrStaff, async (req, res) => {
    // Return column headers as JSON for client-side template generation
    const headers = [
      'title', 'slug', 'description', 'content_type', 'status', 'section',
      'country_code', 'linked_quiz_slug', 'order', 'language', 'content_body_html',
      'video_url', 'document_url', 'image_url', 'alt_text', 'duration',
      'category_tag', 'display_name', 'file_size'
    ];
    const validations = {
      content_type: ['lesson', 'video', 'image', 'document', 'quiz'],
      status: ['draft', 'published', 'archived'],
      language: ['en', 'tr', 'ru', 'ar', 'az', 'fa'],
    };
    res.json({ success: true, headers, validations });
  });

  app.post('/api/admin/content/bulk-import', requireAdminOrStaff, async (req, res) => {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, message: 'No rows provided' });
      }

      const user = (req as any).user;
      const results = { created: 0, updated: 0, errors: [] as any[] };

      // Get existing content for upsert matching (by slug)
      const allContents = await storage.getContents();
      const contentBySlug = new Map(allContents.map(c => [c.slug, c]));

      // Get countries for validation
      const countries = await storage.getCountries();
      const countryCodes = new Set(countries.map(c => c.code));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowErrors: string[] = [];

        // Validate required fields
        if (!row.title) rowErrors.push('title is required');
        if (!row.slug) rowErrors.push('slug is required');
        if (!row.content_type) rowErrors.push('content_type is required');
        if (row.country_code && !countryCodes.has(row.country_code)) {
          rowErrors.push(`unknown country_code: ${row.country_code}`);
        }

        if (rowErrors.length > 0) {
          results.errors.push({ row: i + 1, slug: row.slug, errors: rowErrors });
          continue;
        }

        try {
          const existing = contentBySlug.get(row.slug);
          const contentData = {
            title: row.title,
            slug: row.slug,
            description: row.description || null,
            type: row.content_type || 'lesson',
            contentType: row.content_type || null,
            status: row.status || 'draft',
            section: row.section || null,
            countryCode: row.country_code || null,
            language: row.language || 'en',
            content: row.content_body_html || null,
            videoUrl: row.video_url || null,
            documentUrl: row.document_url || null,
            imageUrl: row.image_url || null,
            altText: row.alt_text || null,
            videoDuration: row.duration ? parseInt(row.duration) : null,
            categoryTag: row.category_tag || null,
            displayName: row.display_name || null,
            fileSize: row.file_size || null,
            order: row.order ? parseInt(row.order) : 0,
          };

          if (existing) {
            await storage.updateContent(existing.id, contentData as any);
            results.updated++;
          } else {
            await storage.createContent(contentData as any);
            results.created++;
          }
        } catch (err: any) {
          results.errors.push({ row: i + 1, slug: row.slug, errors: [err.message] });
        }
      }

      res.json({
        success: true,
        created: results.created,
        updated: results.updated,
        skipped: results.errors.length,
        errors: results.errors,
      });
    } catch (error: any) {
      console.error('Bulk import error:', error);
      res.status(500).json({ success: false, message: 'Bulk import failed: ' + error.message });
    }
  });

  // Chat API endpoint - Proxy to n8n webhook
  // ---- Findy AI Admin Routes ----
  app.get('/api/admin/findy/config', requireAdminOrStaff, async (req, res) => {
    const configs = await storage.getFindyConfigs();
    const configMap: Record<string, string | null> = {};
    for (const c of configs) configMap[c.key] = c.value;
    res.json({ success: true, config: configMap });
  });

  app.post('/api/admin/findy/config', requireAdmin, async (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ success: false, message: 'key is required' });
    const user = (req as any).user;
    const config = await storage.setFindyConfig(key, String(value ?? ''), user?.id);
    res.json({ success: true, config });
  });

  app.post('/api/admin/findy/config/bulk', requireAdmin, async (req, res) => {
    const { configs } = req.body; // { key: string, value: string }[]
    if (!Array.isArray(configs)) return res.status(400).json({ success: false, message: 'configs must be an array' });
    const user = (req as any).user;
    const results = [];
    for (const { key, value } of configs) {
      if (key) results.push(await storage.setFindyConfig(key, String(value ?? ''), user?.id));
    }
    res.json({ success: true, updated: results.length });
  });

  app.get('/api/admin/findy/conversations', requireAdminOrStaff, async (req, res) => {
    const limit = parseInt(String(req.query.limit || '100'));
    const conversations = await storage.getFindyConversations(limit);
    res.json({ success: true, conversations });
  });

  app.get('/api/admin/findy/conversations/:id', requireAdminOrStaff, async (req, res) => {
    const conversation = await storage.getFindyConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
    const messages = await storage.getFindyMessages(req.params.id);
    res.json({ success: true, conversation, messages });
  });

  app.get('/api/admin/findy/analytics', requireAdminOrStaff, async (req, res) => {
    const analytics = await storage.getFindyAnalytics();
    res.json({ success: true, analytics });
  });

  // Public Findy config endpoint (for widget, only returns safe keys)
  app.get('/api/findy/widget-config', async (req, res) => {
    const SAFE_KEYS = ['persona_name', 'welcome_message', 'input_placeholder', 'widget_position', 'widget_primary_color', 'widget_enabled'];
    const configs = await storage.getFindyConfigs();
    const configMap: Record<string, string | null> = {};
    for (const c of configs) {
      if (SAFE_KEYS.includes(c.key)) configMap[c.key] = c.value;
    }
    res.json({ success: true, config: configMap });
  });

  // ── Knowledge Sources (Findy RAG) ────────────────────────────────────────────
  // Multer for knowledge file uploads
  const knowledgeUploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const p = path.join(process.cwd(), 'public', 'uploads', 'knowledge');
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      cb(null, p);
    },
    filename: (req, file, cb) => {
      const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, 'kb-' + suffix + path.extname(file.originalname));
    },
  });
  const knowledgeFileFilter = (req: any, file: any, cb: any) => {
    const allowed = /xlsx|xls|csv|pdf|doc|docx/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Only Excel, PDF, or Word files are allowed'));
  };
  const knowledgeUpload = multer({ storage: knowledgeUploadStorage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: knowledgeFileFilter });

  // ── Helper: parse file into text chunks ──────────────────────────────────────
  async function parseKnowledgeFile(filePath: string, ext: string): Promise<{ chunks: Array<{ content: string; keywords: string; metadata: any }>; rowCount: number }> {
    const extLower = ext.toLowerCase().replace('.', '');

    // ── Excel / CSV ─────────────────────────────────────────────────────────────
    if (['xlsx', 'xls', 'csv'].includes(extLower)) {
      const XLSX = await import('xlsx');
      const wb = XLSX.readFile(filePath);
      const chunks: Array<{ content: string; keywords: string; metadata: any }> = [];
      let totalRows = 0;
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
        totalRows += rows.length;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          // Build readable content line
          const parts = Object.entries(row)
            .filter(([k, v]) => !k.startsWith('__EMPTY') && String(v).trim())
            .map(([k, v]) => `${k}: ${v}`);
          if (parts.length === 0) continue;
          const content = parts.join(' | ');
          const keywords = parts
            .flatMap(p => p.split(/[\s|:,]+/))
            .filter(w => w.length > 2)
            .join(' ')
            .toLowerCase();
          chunks.push({ content, keywords, metadata: { sheet: sheetName, rowIndex: i + 2, ...row } });
        }
      }
      return { chunks, rowCount: totalRows };
    }

    // ── PDF ─────────────────────────────────────────────────────────────────────
    if (extLower === 'pdf') {
      const pdfModule = await import('pdf-parse');
      const pdfParse = (pdfModule as any).default ?? pdfModule;
      const buffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(buffer);
      const fullText = pdfData.text;
      const chunks = splitTextToChunks(fullText, 600).map((c, i) => ({
        content: c,
        keywords: c.toLowerCase().split(/\s+/).filter(w => w.length > 3).join(' '),
        metadata: { page: i + 1 },
      }));
      return { chunks, rowCount: chunks.length };
    }

    // ── Word ─────────────────────────────────────────────────────────────────────
    if (['doc', 'docx'].includes(extLower)) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      const fullText = result.value;
      const chunks = splitTextToChunks(fullText, 600).map((c, i) => ({
        content: c,
        keywords: c.toLowerCase().split(/\s+/).filter(w => w.length > 3).join(' '),
        metadata: { chunkIndex: i },
      }));
      return { chunks, rowCount: chunks.length };
    }

    return { chunks: [], rowCount: 0 };
  }

  function splitTextToChunks(text: string, wordsPerChunk: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
    }
    return chunks;
  }

  // GET /api/admin/findy/sources — list all knowledge sources
  app.get('/api/admin/findy/sources', requireAuth, requireAdminOrStaff, async (req, res) => {
    try {
      const sources = await storage.getKnowledgeSources();
      res.json({ success: true, sources });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch sources' });
    }
  });

  // POST /api/admin/findy/sources/upload — upload file source
  app.post('/api/admin/findy/sources/upload', requireAuth, requireAdminOrStaff, knowledgeUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
      const { file } = req;
      const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
      const fileTypeMap: Record<string, string> = { xlsx: 'excel', xls: 'excel', csv: 'excel', pdf: 'pdf', doc: 'word', docx: 'word' };
      const displayName = req.body.name?.trim() || file.originalname.replace(/\.[^.]+$/, '');
      const userId = (req as any).user?.id;

      // Create source record (processing)
      const source = await storage.createKnowledgeSource({
        name: displayName,
        type: 'file',
        fileType: fileTypeMap[ext] || ext,
        originalName: file.originalname,
        filePath: file.path,
        status: 'processing',
        uploadedBy: userId,
      });

      res.json({ success: true, source });

      // Process in background (don't block HTTP response)
      setImmediate(async () => {
        try {
          const { chunks, rowCount } = await parseKnowledgeFile(file.path, ext);
          await storage.deleteChunksBySourceId(source.id);
          await storage.addKnowledgeChunks(chunks.map(c => ({ sourceId: source.id, content: c.content, keywords: c.keywords, metadata: c.metadata })));
          await storage.updateKnowledgeSource(source.id, { status: 'active', rowCount, chunkCount: chunks.length });
        } catch (err: any) {
          await storage.updateKnowledgeSource(source.id, { status: 'error', errorMessage: err.message });
        }
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Upload failed' });
    }
  });

  // POST /api/admin/findy/sources/url — add URL source
  app.post('/api/admin/findy/sources/url', requireAuth, requireAdminOrStaff, async (req, res) => {
    try {
      const { url, name } = req.body;
      if (!url) return res.status(400).json({ success: false, message: 'URL is required' });
      const displayName = name?.trim() || url;
      const userId = (req as any).user?.id;

      const source = await storage.createKnowledgeSource({
        name: displayName,
        type: 'url',
        fileType: 'url',
        url,
        status: 'processing',
        uploadedBy: userId,
      });

      res.json({ success: true, source });

      setImmediate(async () => {
        try {
          const fetchRes = await fetch(url, { signal: AbortSignal.timeout(15000) });
          const html = await fetchRes.text();
          // Strip HTML tags
          const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const chunks = splitTextToChunks(text, 600).map((c, i) => ({
            content: c,
            keywords: c.toLowerCase().split(/\s+/).filter(w => w.length > 3).join(' '),
            metadata: { url, chunkIndex: i },
          }));
          await storage.addKnowledgeChunks(chunks.map(c => ({ sourceId: source.id, content: c.content, keywords: c.keywords, metadata: c.metadata })));
          await storage.updateKnowledgeSource(source.id, { status: 'active', rowCount: chunks.length, chunkCount: chunks.length });
        } catch (err: any) {
          await storage.updateKnowledgeSource(source.id, { status: 'error', errorMessage: err.message });
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to add URL source' });
    }
  });

  // DELETE /api/admin/findy/sources/:id — delete source and its chunks
  app.delete('/api/admin/findy/sources/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const src = await storage.getKnowledgeSourceById(req.params.id);
      if (!src) return res.status(404).json({ success: false, message: 'Source not found' });
      if (src.filePath && fs.existsSync(src.filePath)) {
        try { fs.unlinkSync(src.filePath); } catch {}
      }
      await storage.deleteKnowledgeSource(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete source' });
    }
  });

  // POST /api/admin/findy/sources/:id/reprocess — reparse the file
  app.post('/api/admin/findy/sources/:id/reprocess', requireAuth, requireAdmin, async (req, res) => {
    try {
      const src = await storage.getKnowledgeSourceById(req.params.id);
      if (!src) return res.status(404).json({ success: false, message: 'Source not found' });
      await storage.updateKnowledgeSource(src.id, { status: 'processing', errorMessage: null });
      res.json({ success: true, message: 'Reprocessing started' });
      setImmediate(async () => {
        try {
          if (src.type === 'file' && src.filePath) {
            const ext = path.extname(src.originalName || '').replace('.', '');
            const { chunks, rowCount } = await parseKnowledgeFile(src.filePath, ext);
            await storage.deleteChunksBySourceId(src.id);
            await storage.addKnowledgeChunks(chunks.map(c => ({ sourceId: src.id, content: c.content, keywords: c.keywords, metadata: c.metadata })));
            await storage.updateKnowledgeSource(src.id, { status: 'active', rowCount, chunkCount: chunks.length });
          } else if (src.type === 'url' && src.url) {
            const fetchRes = await fetch(src.url, { signal: AbortSignal.timeout(15000) });
            const html = await fetchRes.text();
            const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const chunks = splitTextToChunks(text, 600).map((c, i) => ({ content: c, keywords: c.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).join(' '), metadata: { url: src.url, chunkIndex: i } }));
            await storage.deleteChunksBySourceId(src.id);
            await storage.addKnowledgeChunks(chunks.map(c => ({ sourceId: src.id, content: c.content, keywords: c.keywords, metadata: c.metadata })));
            await storage.updateKnowledgeSource(src.id, { status: 'active', rowCount: chunks.length, chunkCount: chunks.length });
          }
        } catch (err: any) {
          await storage.updateKnowledgeSource(src.id, { status: 'error', errorMessage: err.message });
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Reprocess failed' });
    }
  });

  // ── Chat endpoint with RAG ────────────────────────────────────────────────────
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, sessionId } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, message: 'Message is required' });
      }

      // ── Build RAG context from knowledge base ─────────────────────────────────
      let ragContext = '';
      try {
        const chunks = await storage.searchKnowledgeChunks(message, 15);
        if (chunks.length > 0) {
          ragContext = '\n\n---\nKNOWLEDGE BASE (use this data to answer accurately):\n' +
            chunks.map(c => c.content).join('\n') + '\n---\n';
        }
      } catch (err) {
        console.warn('RAG search failed (non-fatal):', err);
      }

      const webhookUrl = process.env.N8N_WEBHOOK_URL;
      
      if (!webhookUrl) {
        // If no webhook, return a direct answer from RAG if available
        if (ragContext) {
          return res.json({
            success: true,
            message: 'I found relevant information in the knowledge base. Please configure an AI provider to get intelligent responses.',
            data: { message: ragContext, hasContext: true }
          });
        }
        return res.status(500).json({ success: false, message: 'Chat service is not configured' });
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context: ragContext, // Inject knowledge context
          sessionId: sessionId || crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) throw new Error(`Webhook returned ${response.status}`);

      const contentType = response.headers.get('content-type');
      let botResponse: string;
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        botResponse = data.message || data.response || data.output || JSON.stringify(data);
      } else {
        botResponse = await response.text();
      }

      res.json({ success: true, message: botResponse, data: { message: botResponse } });
    } catch (error) {
      console.error('Chat API error:', error);
      res.status(500).json({ success: false, message: 'Failed to process chat message' });
    }
  });

  // ── Content File Upload Route ────────────────────────────────────────────────
  // POST /api/uploads/content — upload image or document for course content
  // When the form-data field `purpose=cover` is set AND the upload is an image,
  // the image is downsized server-side to a max of 540x540 (aspect preserved) and
  // re-encoded; this keeps Partner Zone folder cover images small.
  app.post('/api/uploads/content', requireAuth, requireAdminOrStaff, contentUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      const { file } = req;
      let fileCategory: string;
      let folder: string;
      if (file.mimetype.startsWith('image/')) { fileCategory = 'image'; folder = 'images'; }
      else if (file.mimetype.startsWith('video/')) { fileCategory = 'video'; folder = 'videos'; }
      else { fileCategory = 'document'; folder = 'documents'; }

      // Cover-image downsize: only for images flagged as covers and not SVG (sharp can't raster SVG safely without rasterise option).
      const isCover = (req.body?.purpose === 'cover');
      let finalSize = file.size;
      if (isCover && file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') {
        try {
          const original = await fs.promises.readFile(file.path);
          const resized = await sharp(original)
            .rotate() // honour EXIF orientation
            .resize({ width: 540, height: 540, fit: 'inside', withoutEnlargement: true })
            .toBuffer();
          await fs.promises.writeFile(file.path, resized);
          finalSize = resized.length;
        } catch (resizeErr) {
          console.warn('Cover image resize failed, keeping original:', resizeErr);
        }
      }

      const publicUrl = `/uploads/content/${folder}/${file.filename}`;
      const fileSizeMB = (finalSize / (1024 * 1024)).toFixed(2) + ' MB';
      res.json({
        success: true,
        url: publicUrl,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: fileSizeMB,
        type: fileCategory,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Upload failed';
      res.status(400).json({ success: false, message: msg });
    }
  });

  // ── Content Translation Routes ──────────────────────────────────────────────
  // GET /api/admin/contents/:id/translations — list all translations for a content item
  app.get('/api/admin/contents/:id/translations', requireAuth, requireAdminOrStaff, async (req, res) => {
    try {
      const translations = await storage.getContentTranslations(req.params.id);
      res.json({ success: true, data: translations });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch translations' });
    }
  });

  // GET /api/admin/contents/:id/translations/:lang — single translation
  app.get('/api/admin/contents/:id/translations/:lang', requireAuth, requireAdminOrStaff, async (req, res) => {
    try {
      const translation = await storage.getContentTranslation(req.params.id, req.params.lang);
      if (!translation) return res.status(404).json({ success: false, message: 'Translation not found' });
      res.json({ success: true, data: translation });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch translation' });
    }
  });

  // PUT /api/admin/contents/:id/translations/:lang — upsert a translation
  app.put('/api/admin/contents/:id/translations/:lang', requireAuth, requireAdminOrStaff, async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { title, description, content, status } = req.body;
      const translation = await storage.upsertContentTranslation({
        contentId: req.params.id,
        language: req.params.lang,
        title: title || null,
        description: description || null,
        content: content || null,
        status: status || 'draft',
        translatedBy: userId,
      });
      res.json({ success: true, data: translation });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to save translation' });
    }
  });

  // DELETE /api/admin/contents/:id/translations/:lang — delete a translation
  app.delete('/api/admin/contents/:id/translations/:lang', requireAuth, requireAdminOrStaff, async (req, res) => {
    try {
      await storage.deleteContentTranslation(req.params.id, req.params.lang);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete translation' });
    }
  });

  // GET /api/admin/translations — list all translations across all content
  app.get('/api/admin/translations', requireAuth, requireAdminOrStaff, async (req, res) => {
    try {
      const translations = await storage.getAllTranslations();
      res.json({ success: true, data: translations });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch translations' });
    }
  });

  // Public: GET /api/public/contents/:id/translation?lang=tr — serve translated content to agents
  app.get('/api/public/contents/:id/translation', async (req, res) => {
    try {
      const lang = (req.query.lang as string) || 'en';
      const translation = await storage.getContentTranslation(req.params.id, lang);
      res.json({ success: true, data: translation || null });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch translation' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}