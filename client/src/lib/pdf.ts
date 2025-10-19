import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Certificate, User, Course, Agency } from '../types';
import certificateBackground from '@assets/train_1760536930109.png';

export const generateCertificatePDF = async (
  certificate: Certificate,
  user: User,
  course: Course,
  agency: Agency | null
): Promise<void> => {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  // Generate QR code
  const verifyUrl = `${window.location.origin}/verify?code=${certificate.code}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { 
    width: 100, 
    margin: 1,
    color: { dark: '#143591' }
  });

  // Convert background image URL to data URL for jsPDF
  const bgDataUrl = await new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load background image'));
    img.src = certificateBackground;
  });

  // Add background image
  doc.addImage(bgDataUrl, 'PNG', 0, 0, 297, 210);
  
  // Title (1cm aşağı kaydırıldı)
  doc.setTextColor(20, 53, 145); // Navy blue color matching the border
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICATE OF COMPLETION', 148.5, 50, { align: 'center' });
  
  // Main content
  doc.setTextColor(20, 53, 145); // Navy blue
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('This is to certify that', 148.5, 65, { align: 'center' });
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(user.name.toUpperCase(), 148.5, 80, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('representing', 148.5, 95, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(agency?.name || 'Independent Agent', 148.5, 110, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('has successfully completed the', 148.5, 125, { align: 'center' });
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(course.title, 148.5, 140, { align: 'center' });
  
  // Score and details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Final Score: ${certificate.scorePercent}%`, 148.5, 160, { align: 'center' });
  doc.text(`Certificate Code: ${certificate.code}`, 148.5, 170, { align: 'center' });
  doc.text(`Date of Issue: ${new Date(certificate.issuedAt).toLocaleDateString()}`, 148.5, 180, { align: 'center' });

  // Signature (2cm yukarı kaldırıldı)
  doc.setFontSize(12);
  doc.text('Dr. Eymen NAMAZCI', 60, 170);
  doc.setFontSize(10);
  doc.text('CEO of Find And Study', 60, 177);

  // Add QR code (2cm yukarı kaldırıldı)
  doc.addImage(qrDataUrl, 'PNG', 225, 155, 25, 25);
  doc.setFontSize(8);
  doc.text('Scan to verify', 237.5, 185, { align: 'center' });

  // Save the PDF
  const fileName = `FAS_Certificate_${user.name.replace(/\s+/g, '_')}_${course.title.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};

export const generateBadgePNG = (user: User): void => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 200;
  canvas.height = 200;

  // Background circle
  ctx.fillStyle = '#143591';
  ctx.beginPath();
  ctx.arc(100, 100, 90, 0, 2 * Math.PI);
  ctx.fill();

  // White inner circle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(100, 100, 75, 0, 2 * Math.PI);
  ctx.fill();

  // Initials
  ctx.fillStyle = '#143591';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2);
  ctx.fillText(initials, 100, 90);

  // "CERTIFIED" text
  ctx.font = 'bold 12px Arial';
  ctx.fillText('CERTIFIED', 100, 130);

  // "AGENT" text
  ctx.font = 'bold 10px Arial';
  ctx.fillText('AGENT', 100, 145);

  // Download
  canvas.toBlob((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FAS_Badge_${user.name.replace(/\s+/g, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
  });
};