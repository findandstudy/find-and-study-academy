import QRCode from 'qrcode';

export const generateQRDataURL = async (text: string): Promise<string> => {
  try {
    const qrDataUrl = await QRCode.toDataURL(text, {
      width: 200,
      margin: 2,
      color: {
        dark: '#143591',
        light: '#FFFFFF'
      }
    });
    return qrDataUrl;
  } catch (error) {
    console.error('QR code generation failed:', error);
    return '';
  }
};