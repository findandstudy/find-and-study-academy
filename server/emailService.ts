import { sendEmail } from './gmail';

export interface EmailNotificationOptions {
  recipientEmail: string;
  recipientName: string;
  type: 'certificate' | 'course_completion' | 'announcement' | 'welcome';
  data?: any;
}

function generateCertificateEmail(name: string, courseName: string, certificateUrl?: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Congratulations!</h1>
        </div>
        <div class="content">
          <h2>Dear ${name},</h2>
          <p>You have successfully completed <strong>${courseName}</strong> and your certificate is ready!</p>
          <p>This achievement takes your expertise in study abroad consulting to the next level.</p>
          ${certificateUrl ? `<a href="${certificateUrl}" class="button">Download My Certificate</a>` : ''}
          <p style="margin-top: 30px;">Continue using our platform to gain more knowledge and certifications.</p>
        </div>
        <div class="footer">
          <p>Find And Study - Agents Portal</p>
          <p>Feel free to contact us if you have any questions.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateCourseCompletionEmail(name: string, courseName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Course Completed!</h1>
        </div>
        <div class="content">
          <h2>Dear ${name},</h2>
          <p>You have completed all lessons in <strong>${courseName}</strong>!</p>
          <p>Now take your exams to get one step closer to earning your certificate.</p>
          <p style="margin-top: 30px;">Best of luck!</p>
        </div>
        <div class="footer">
          <p>Find And Study - Agents Portal</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateAnnouncementEmail(name: string, title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Announcement</h1>
        </div>
        <div class="content">
          <h2>Dear ${name},</h2>
          <h3>${title}</h3>
          <p>${content}</p>
        </div>
        <div class="footer">
          <p>Find And Study - Agents Portal</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateWelcomeEmail(name: string, agencyName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome!</h1>
        </div>
        <div class="content">
          <h2>Dear ${name},</h2>
          <p>Welcome to Find And Study Agents Portal!</p>
          <p>Your account for <strong>${agencyName}</strong> has been successfully created.</p>
          <p>On our platform you can:</p>
          <ul>
            <li>Enroll in training courses</li>
            <li>Take exams</li>
            <li>Earn certificates</li>
            <li>Compete on the leaderboard</li>
          </ul>
          <p style="margin-top: 30px;">We wish you success!</p>
        </div>
        <div class="footer">
          <p>Find And Study - Agents Portal</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendNotificationEmail(options: EmailNotificationOptions): Promise<boolean> {
  try {
    let subject = '';
    let html = '';

    switch (options.type) {
      case 'certificate':
        subject = `Your Certificate is Ready - ${options.data?.courseName || 'Course'}`;
        html = generateCertificateEmail(
          options.recipientName,
          options.data?.courseName || 'Course',
          options.data?.certificateUrl
        );
        break;

      case 'course_completion':
        subject = `Course Completed - ${options.data?.courseName || 'Course'}`;
        html = generateCourseCompletionEmail(
          options.recipientName,
          options.data?.courseName || 'Course'
        );
        break;

      case 'announcement':
        subject = `New Announcement - ${options.data?.title || ''}`;
        html = generateAnnouncementEmail(
          options.recipientName,
          options.data?.title || '',
          options.data?.content || ''
        );
        break;

      case 'welcome':
        subject = 'Welcome to Find And Study Agents Portal!';
        html = generateWelcomeEmail(
          options.recipientName,
          options.data?.agencyName || 'Your Agency'
        );
        break;

      default:
        return false;
    }

    const result = await sendEmail({
      to: options.recipientEmail,
      subject,
      html
    });

    return result;
  } catch (error) {
    console.error('Email notification error:', error);
    return false;
  }
}
