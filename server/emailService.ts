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
          <h1>🎓 Tebrikler!</h1>
        </div>
        <div class="content">
          <h2>Sayın ${name},</h2>
          <p><strong>${courseName}</strong> kursunu başarıyla tamamladınız ve sertifikanız hazır!</p>
          <p>Bu başarı, yurt dışı eğitim danışmanlığı alanındaki uzmanlığınızı bir adım daha ileriye taşıyor.</p>
          ${certificateUrl ? `<a href="${certificateUrl}" class="button">Sertifikamı İndir</a>` : ''}
          <p style="margin-top: 30px;">Platformumuzu kullanmaya devam ederek daha fazla bilgi ve sertifika kazanabilirsiniz.</p>
        </div>
        <div class="footer">
          <p>Find And Study - Agents Portal</p>
          <p>Sorularınız için bizimle iletişime geçebilirsiniz.</p>
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
          <h1>✅ Kurs Tamamlandı!</h1>
        </div>
        <div class="content">
          <h2>Sayın ${name},</h2>
          <p><strong>${courseName}</strong> kursundaki tüm dersleri tamamladınız!</p>
          <p>Şimdi sınavlarınızı yaparak sertifikanızı almaya bir adım daha yaklaşın.</p>
          <p style="margin-top: 30px;">Başarılar dileriz!</p>
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
          <h1>📢 Yeni Duyuru</h1>
        </div>
        <div class="content">
          <h2>Sayın ${name},</h2>
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
          <h1>🎉 Hoş Geldiniz!</h1>
        </div>
        <div class="content">
          <h2>Sayın ${name},</h2>
          <p>Find And Study Agents Portal'a hoş geldiniz!</p>
          <p><strong>${agencyName}</strong> ajansınız için hesabınız başarıyla oluşturuldu.</p>
          <p>Platformumuzda:</p>
          <ul>
            <li>📚 Eğitim kurslarına katılabilir</li>
            <li>📝 Sınavlara girebilir</li>
            <li>🎓 Sertifika kazanabilir</li>
            <li>🏆 Liderlik tablosunda yarışabilirsiniz</li>
          </ul>
          <p style="margin-top: 30px;">Başarılar dileriz!</p>
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
        subject = `🎓 Sertifikanız Hazır - ${options.data?.courseName || 'Kurs'}`;
        html = generateCertificateEmail(
          options.recipientName,
          options.data?.courseName || 'Kurs',
          options.data?.certificateUrl
        );
        break;

      case 'course_completion':
        subject = `✅ Kurs Tamamlandı - ${options.data?.courseName || 'Kurs'}`;
        html = generateCourseCompletionEmail(
          options.recipientName,
          options.data?.courseName || 'Kurs'
        );
        break;

      case 'announcement':
        subject = `📢 Yeni Duyuru - ${options.data?.title || ''}`;
        html = generateAnnouncementEmail(
          options.recipientName,
          options.data?.title || '',
          options.data?.content || ''
        );
        break;

      case 'welcome':
        subject = '🎉 Find And Study Agents Portal\'a Hoş Geldiniz!';
        html = generateWelcomeEmail(
          options.recipientName,
          options.data?.agencyName || 'Ajansınız'
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
