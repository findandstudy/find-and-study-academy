import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCertificateSchema } from "@shared/schema";
import crypto from "crypto";

// Authentication middleware - verify user session
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // For now, extract user info from request headers (in real app would use proper session/JWT)
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;
    
    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Add user info to request for use in route handlers
    (req as any).user = { id: userId, role: userRole };
    next();
  } catch (error) {
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

export async function registerRoutes(app: Express): Promise<Server> {
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

  const httpServer = createServer(app);

  return httpServer;
}
