// API utility for server-side certificate verification
import { getSession } from './auth';
export interface CertificateVerificationResponse {
  success: boolean;
  message?: string;
  code?: string;
  certificate?: {
    id: string;
    code: string;
    scorePercent: number;
    issuedAt: string;
    user: {
      id: string;
      name: string;
    } | null;
    course: {
      id: string;
      title: string;
    } | null;
  };
}

export async function verifyCertificate(code: string): Promise<CertificateVerificationResponse> {
  try {
    const response = await fetch(`/api/verify?code=${encodeURIComponent(code)}`);
    const data: CertificateVerificationResponse = await response.json();
    
    return data;
  } catch (error) {
    console.error('Certificate verification API error:', error);
    return {
      success: false,
      message: 'Network error during verification'
    };
  }
}

// Certificate issuance API
export interface CertificateIssuanceRequest {
  userId: string;
  courseId: string;
  scorePercent: number;
  code: string;
}

export interface CertificateIssuanceResponse {
  success: boolean;
  message?: string;
  certificate?: {
    id: string;
    code: string;
    scorePercent: number;
    issuedAt: string;
  };
}

// Submit quiz attempt to server
export async function submitAttempt(attemptData: {
  quizId: string;
  scorePercent: number;
  correct: number;
  incorrect: number;
}): Promise<{ success: boolean; message?: string; attempt?: any }> {
  try {
    const session = getSession();
    if (!session) {
      return {
        success: false,
        message: 'Authentication required'
      };
    }

    const response = await fetch('/api/attempts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': session.user.id,
        'x-user-role': session.role,
      },
      body: JSON.stringify(attemptData),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Attempt submission error:', error);
    return {
      success: false,
      message: 'Network error during attempt submission'
    };
  }
}

export async function issueCertificate(data: { courseId: string; quizId: string }): Promise<CertificateIssuanceResponse> {
  try {
    // Get user session for authentication
    const session = getSession();
    if (!session) {
      return {
        success: false,
        message: 'Authentication required'
      };
    }

    const response = await fetch('/api/certificates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': session.user.id,
        'x-user-role': session.role,
      },
      body: JSON.stringify(data),
    });

    const result: CertificateIssuanceResponse = await response.json();
    return result;
  } catch (error) {
    console.error('Certificate issuance API error:', error);
    return {
      success: false,
      message: 'Network error during certificate issuance'
    };
  }
}