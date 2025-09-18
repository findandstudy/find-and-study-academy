import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { verifyCertificate, type CertificateVerificationResponse } from '@/lib/api';
import { CheckCircle, XCircle, Search, Award, Loader2 } from 'lucide-react';

export default function VerifyCertificate() {
  const [location] = useLocation();
  const [code, setCode] = useState('');
  const [verificationResult, setVerificationResult] = useState<'valid' | 'invalid' | null>(null);
  const [certificateData, setCertificateData] = useState<CertificateVerificationResponse['certificate'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Auto-verify if code is in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('code');
    if (urlCode) {
      setCode(urlCode);
      handleVerifyCertificate(urlCode);
    }
  }, []);

  const handleVerifyCertificate = async (verifyCode: string) => {
    setIsLoading(true);
    
    try {
      const result = await verifyCertificate(verifyCode);
      
      if (result.success && result.certificate) {
        setVerificationResult('valid');
        setCertificateData(result.certificate);
      } else {
        setVerificationResult('invalid');
        setCertificateData(null);
      }
    } catch (error) {
      console.error('Verification failed:', error);
      setVerificationResult('invalid');
      setCertificateData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = () => {
    if (code.trim()) {
      handleVerifyCertificate(code.trim());
    }
  };

  const handleReset = () => {
    setCode('');
    setVerificationResult(null);
    setCertificateData(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">F&S</span>
          </div>
          <CardTitle>Certificate Verification</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter a certificate code to verify its authenticity
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {verificationResult === null && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter certificate code (e.g., FAS-ABC123)"
                  disabled={isLoading}
                  data-testid="input-certificate-code"
                />
                <Button onClick={handleVerify} disabled={isLoading || !code.trim()} data-testid="button-verify">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Certificate codes are found on official Find And Study certificates
              </p>
            </div>
          )}

          {verificationResult === 'valid' && certificateData && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-green-700">Valid Certificate</h3>
                <Badge className="mt-1 bg-green-100 text-green-700 hover:bg-green-200">Verified</Badge>
              </div>

              <div className="bg-green-50 rounded-lg p-4 text-left space-y-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-800">Certificate Details</span>
                </div>
                
                <div className="space-y-1 text-sm">
                  <p><strong>Recipient:</strong> {certificateData.user?.name}</p>
                  <p><strong>Course:</strong> {certificateData.course?.title}</p>
                  <p><strong>Score:</strong> {certificateData.scorePercent}%</p>
                  <p><strong>Issued:</strong> {new Date(certificateData.issuedAt).toLocaleDateString()}</p>
                  <p><strong>Code:</strong> {certificateData.code}</p>
                </div>
              </div>

              <Button onClick={handleReset} variant="outline" data-testid="button-verify-another">
                Verify Another Certificate
              </Button>
            </div>
          )}

          {verificationResult === 'invalid' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-red-700">Invalid Certificate</h3>
                <Badge variant="destructive" className="mt-1">Not Found</Badge>
              </div>

              <div className="bg-red-50 rounded-lg p-4 text-left">
                <p className="text-sm text-red-700">
                  The certificate code <strong>{code}</strong> could not be verified. 
                  This may mean:
                </p>
                <ul className="text-sm text-red-600 mt-2 ml-4 list-disc">
                  <li>The code was entered incorrectly</li>
                  <li>The certificate has been revoked</li>
                  <li>The certificate does not exist</li>
                </ul>
              </div>

              <Button onClick={handleReset} variant="outline" data-testid="button-try-again">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}