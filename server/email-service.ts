import type { EmailLog, User, Course } from "@shared/schema";

// Email template types
export type EmailTemplateType = 'welcome' | 'course_completion' | 'certificate' | 'announcement';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface CourseCompletionData {
  userName: string;
  courseName: string;
  scorePercent: number;
  certificateUrl?: string;
}

interface CertificateData {
  userName: string;
  courseName: string;
  certificateCode: string;
  verificationUrl: string;
}

interface AnnouncementData {
  userName: string;
  title: string;
  content: string;
  priority: string;
}

interface WelcomeData {
  userName: string;
  agencyName?: string;
}

// Email service configuration
export class EmailService {
  private fromEmail: string;
  private appUrl: string;

  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@findandstudy.com';
    this.appUrl = process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000';
  }

  // Generate welcome email template
  private getWelcomeTemplate(data: WelcomeData): EmailTemplate {
    return {
      subject: 'Welcome to Find & Study Academy! 🎓',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ed1c24 0%, #c41119 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #ed1c24; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Find & Study Academy!</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName}! 👋</h2>
                <p>We're excited to have you join our community of study abroad professionals.</p>
                ${data.agencyName ? `<p>Your agency <strong>${data.agencyName}</strong> has been successfully registered.</p>` : ''}
                <p>Get started by exploring our courses and begin your learning journey:</p>
                <a href="${this.appUrl}/agent/courses" class="button">Browse Courses</a>
                <p>If you have any questions, feel free to reach out to our support team.</p>
              </div>
              <div class="footer">
                <p>© 2024 Find & Study Academy. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Welcome to Find & Study Academy!\n\nHello ${data.userName}!\n\nWe're excited to have you join our community of study abroad professionals.${data.agencyName ? `\n\nYour agency ${data.agencyName} has been successfully registered.` : ''}\n\nGet started by exploring our courses: ${this.appUrl}/agent/courses\n\n© 2024 Find & Study Academy`
    };
  }

  // Generate course completion email template
  private getCourseCompletionTemplate(data: CourseCompletionData): EmailTemplate {
    const passed = data.scorePercent >= 70;
    return {
      subject: passed ? `🎉 Congratulations! You completed ${data.courseName}` : `Course Update: ${data.courseName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: ${passed ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .score-box { background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px solid ${passed ? '#10b981' : '#f59e0b'}; }
              .score { font-size: 48px; font-weight: bold; color: ${passed ? '#10b981' : '#f59e0b'}; }
              .button { display: inline-block; background: #ed1c24; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${passed ? '🎉 Congratulations!' : '📚 Course Completed'}</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName}!</h2>
                <p>You have completed the course: <strong>${data.courseName}</strong></p>
                <div class="score-box">
                  <p>Your Score</p>
                  <div class="score">${data.scorePercent}%</div>
                  <p>${passed ? 'Passed! ✅' : 'Needs Improvement'}</p>
                </div>
                ${passed && data.certificateUrl ? `
                  <p>🏆 <strong>You've earned a certificate!</strong></p>
                  <a href="${data.certificateUrl}" class="button">Download Certificate</a>
                ` : `
                  <p>Keep learning! You need 70% or higher to earn a certificate.</p>
                  <a href="${this.appUrl}/agent/courses" class="button">Continue Learning</a>
                `}
              </div>
              <div class="footer">
                <p>© 2024 Find & Study Academy. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `${passed ? 'Congratulations!' : 'Course Completed'}\n\nHello ${data.userName}!\n\nYou have completed ${data.courseName}\nYour Score: ${data.scorePercent}%\n${passed ? 'Passed! ✅' : 'Needs Improvement (70% required)'}\n\n${passed && data.certificateUrl ? `Download Certificate: ${data.certificateUrl}` : `Continue Learning: ${this.appUrl}/agent/courses`}\n\n© 2024 Find & Study Academy`
    };
  }

  // Generate certificate email template
  private getCertificateTemplate(data: CertificateData): EmailTemplate {
    return {
      subject: `🏆 Your Certificate is Ready - ${data.courseName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .certificate-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border: 3px solid #8b5cf6; }
              .button { display: inline-block; background: #ed1c24; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
              .code { font-family: 'Courier New', monospace; font-size: 20px; font-weight: bold; color: #8b5cf6; letter-spacing: 2px; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏆 Certificate Awarded!</h1>
              </div>
              <div class="content">
                <h2>Congratulations ${data.userName}!</h2>
                <p>You have successfully earned a certificate for:</p>
                <div class="certificate-box">
                  <h3 style="margin-top: 0;">${data.courseName}</h3>
                  <p>Certificate Code:</p>
                  <p class="code">${data.certificateCode}</p>
                </div>
                <p>Your certificate can be verified by anyone using the code above.</p>
                <div style="text-align: center;">
                  <a href="${data.verificationUrl}" class="button">Download Certificate</a>
                  <a href="${this.appUrl}/verify?code=${data.certificateCode}" class="button">Verify Online</a>
                </div>
              </div>
              <div class="footer">
                <p>© 2024 Find & Study Academy. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `🏆 Certificate Awarded!\n\nCongratulations ${data.userName}!\n\nYou have successfully earned a certificate for ${data.courseName}\n\nCertificate Code: ${data.certificateCode}\n\nDownload: ${data.verificationUrl}\nVerify: ${this.appUrl}/verify?code=${data.certificateCode}\n\n© 2024 Find & Study Academy`
    };
  }

  // Generate announcement email template
  private getAnnouncementTemplate(data: AnnouncementData): EmailTemplate {
    const priorityColors: Record<string, string> = {
      urgent: '#ef4444',
      high: '#f59e0b',
      medium: '#3b82f6',
      low: '#6b7280'
    };
    const color = priorityColors[data.priority] || priorityColors.medium;

    return {
      subject: `${data.priority === 'urgent' ? '🚨 URGENT: ' : '📢 '}${data.title}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: ${color}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .announcement { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${color}; }
              .button { display: inline-block; background: #ed1c24; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${data.priority === 'urgent' ? '🚨 ' : '📢 '}${data.title}</h1>
              </div>
              <div class="content">
                <p>Hello ${data.userName},</p>
                <div class="announcement">
                  ${data.content}
                </div>
                <a href="${this.appUrl}/agent/dashboard" class="button">View Dashboard</a>
              </div>
              <div class="footer">
                <p>© 2024 Find & Study Academy. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `${data.priority === 'urgent' ? '🚨 URGENT: ' : ''}${data.title}\n\nHello ${data.userName},\n\n${data.content}\n\nView Dashboard: ${this.appUrl}/agent/dashboard\n\n© 2024 Find & Study Academy`
    };
  }

  // Send email using Resend (to be integrated)
  async sendEmail(
    to: string,
    templateType: EmailTemplateType,
    data: WelcomeData | CourseCompletionData | CertificateData | AnnouncementData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let template: EmailTemplate;

      switch (templateType) {
        case 'welcome':
          template = this.getWelcomeTemplate(data as WelcomeData);
          break;
        case 'course_completion':
          template = this.getCourseCompletionTemplate(data as CourseCompletionData);
          break;
        case 'certificate':
          template = this.getCertificateTemplate(data as CertificateData);
          break;
        case 'announcement':
          template = this.getAnnouncementTemplate(data as AnnouncementData);
          break;
        default:
          throw new Error(`Unknown template type: ${templateType}`);
      }

      // TODO: Integrate with Resend API once connector is set up
      // For now, log the email details
      console.log('[Email Service] Would send email:', {
        to,
        from: this.fromEmail,
        subject: template.subject,
        templateType
      });

      // Simulate email sending success
      return { success: true };
    } catch (error) {
      console.error('[Email Service] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
