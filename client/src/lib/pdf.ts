import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import type { Certificate, User, Course, Agency } from '../types';

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

  // Add certificate content
  doc.setFillColor(20, 53, 145); // Navy background for header
  doc.rect(0, 0, 297, 30, 'F');
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICATE OF COMPLETION', 148.5, 20, { align: 'center' });

  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Main content
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('This is to certify that', 148.5, 50, { align: 'center' });
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(user.name.toUpperCase(), 148.5, 65, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('representing', 148.5, 80, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(agency?.name || 'Independent Agent', 148.5, 95, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('has successfully completed the', 148.5, 110, { align: 'center' });
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(course.title, 148.5, 125, { align: 'center' });
  
  // Score and details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Final Score: ${certificate.scorePercent}%`, 148.5, 145, { align: 'center' });
  doc.text(`Certificate Code: ${certificate.code}`, 148.5, 155, { align: 'center' });
  doc.text(`Date of Issue: ${new Date(certificate.issuedAt).toLocaleDateString()}`, 148.5, 165, { align: 'center' });

  // Signature
  doc.text('Dr. Eymen Namazcı', 60, 180);
  doc.setFontSize(10);
  doc.text('Program Director', 60, 188);
  doc.text('Find And Study', 60, 195);

  // Add QR code
  doc.addImage(qrDataUrl, 'PNG', 220, 170, 30, 30);
  doc.setFontSize(8);
  doc.text('Scan to verify', 235, 208, { align: 'center' });

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