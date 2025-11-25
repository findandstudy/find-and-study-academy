import nodemailer from 'nodemailer';

// SMTP Configuration for cross-platform email support
// Works on Windows, VPS, and any environment with SMTP credentials

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Create transporter based on environment variables
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    console.log('[SMTP] Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendSmtpEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('[SMTP] Transporter not available, email skipped:', options.subject);
      return false;
    }

    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@findandstudy.com';
    const fromName = process.env.SMTP_FROM_NAME || 'Find & Study Academy';

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log('[SMTP] Email sent successfully to:', options.to);
    return true;
  } catch (error) {
    console.error('[SMTP] Email send error:', error);
    return false;
  }
}

// Email Templates
export function generateWelcomeEmail(name: string, agencyName?: string): { subject: string; html: string } {
  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  
  return {
    subject: 'Find & Study Academy\'e Hoş Geldiniz!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
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
            <h1>Find & Study Academy'e Hoş Geldiniz!</h1>
          </div>
          <div class="content">
            <h2>Merhaba ${name}!</h2>
            <p>Yurtdışı eğitim profesyonelleri topluluğumuza katıldığınız için mutluyuz.</p>
            ${agencyName ? `<p>Ajansınız <strong>${agencyName}</strong> başarıyla kaydedildi.</p>` : ''}
            <p>Kurslarımızı keşfederek öğrenme yolculuğunuza başlayın:</p>
            <a href="${appUrl}/agent/courses" class="button">Kurslara Göz At</a>
            <p>Herhangi bir sorunuz varsa destek ekibimize ulaşabilirsiniz.</p>
          </div>
          <div class="footer">
            <p>© 2024 Find & Study Academy. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

export function generateCertificateEmail(name: string, courseName: string, certificateCode: string): { subject: string; html: string } {
  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  
  return {
    subject: `Tebrikler! ${courseName} Sertifikanız Hazır`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .certificate-code { background: #e5e7eb; padding: 10px 20px; border-radius: 4px; font-family: monospace; font-size: 18px; display: inline-block; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Tebrikler!</h1>
          </div>
          <div class="content">
            <h2>Merhaba ${name}!</h2>
            <p><strong>${courseName}</strong> kursunu başarıyla tamamladınız ve sertifikanız hazır!</p>
            <p>Sertifika Kodunuz:</p>
            <div class="certificate-code">${certificateCode}</div>
            <p>Sertifikanızı görüntülemek ve indirmek için:</p>
            <a href="${appUrl}/verify/${certificateCode}" class="button">Sertifikamı Görüntüle</a>
            <p>Bu başarı, yurtdışı eğitim danışmanlığındaki uzmanlığınızı bir üst seviyeye taşıyor.</p>
          </div>
          <div class="footer">
            <p>© 2024 Find & Study Academy. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

export function generateCourseCompletionEmail(name: string, courseName: string): { subject: string; html: string } {
  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  
  return {
    subject: `${courseName} Kursunu Tamamladınız!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Kurs Tamamlandı!</h1>
          </div>
          <div class="content">
            <h2>Merhaba ${name}!</h2>
            <p><strong>${courseName}</strong> kursundaki tüm dersleri başarıyla tamamladınız.</p>
            <p>Şimdi final sınavına girerek sertifikanızı alabilirsiniz.</p>
            <a href="${appUrl}/agent/courses" class="button">Final Sınavına Git</a>
            <p>Başarılar dileriz!</p>
          </div>
          <div class="footer">
            <p>© 2024 Find & Study Academy. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

export function generateAdminNewRegistrationEmail(agentName: string, agentEmail: string, agencyName: string): { subject: string; html: string } {
  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  
  return {
    subject: `Yeni Acente Kaydı: ${agencyName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Yeni Acente Kaydı</h1>
          </div>
          <div class="content">
            <p>Yeni bir acente sisteme kaydoldu:</p>
            <div class="info-box">
              <p><strong>Acente Adı:</strong> ${agencyName}</p>
              <p><strong>Yetkili Kişi:</strong> ${agentName}</p>
              <p><strong>E-posta:</strong> ${agentEmail}</p>
            </div>
            <p>Acente yönetim panelinden detayları görüntüleyebilir ve onaylayabilirsiniz:</p>
            <a href="${appUrl}/admin/agencies" class="button">Acenteleri Yönet</a>
          </div>
          <div class="footer">
            <p>© 2024 Find & Study Academy. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

export function generateAdminCertificateEmail(agentName: string, agentEmail: string, courseName: string, certificateCode: string): { subject: string; html: string } {
  return {
    subject: `Yeni Sertifika Verildi: ${agentName} - ${courseName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .certificate-code { background: #d1fae5; padding: 10px 20px; border-radius: 4px; font-family: monospace; font-size: 16px; display: inline-block; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Yeni Sertifika Verildi</h1>
          </div>
          <div class="content">
            <p>Bir acente yeni bir sertifika kazandı:</p>
            <div class="info-box">
              <p><strong>Acente:</strong> ${agentName}</p>
              <p><strong>E-posta:</strong> ${agentEmail}</p>
              <p><strong>Kurs:</strong> ${courseName}</p>
              <p><strong>Sertifika Kodu:</strong> <span class="certificate-code">${certificateCode}</span></p>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 Find & Study Academy. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}
