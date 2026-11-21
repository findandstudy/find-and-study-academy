import {useQuery} from '@tanstack/react-query';
import {countryLabel, courseText} from '@/i18n/course-labels';
import {LanguageSwitcher} from '@/components/LanguageSwitcher';
import { legacyUi,legacyDate } from '@/lib/legacy-ui';
import {usePublicUi} from '@/lib/public-ui';
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { verifyCertificate, type CertificateVerificationResponse } from '@/lib/api';
import { CheckCircle, XCircle, Search, Award, Loader2 } from 'lucide-react';

export default function VerifyCertificate() {
  const {tl,locale}=usePublicUi();
  const [location] = useLocation();
  const [code, setCode] = useState('');
  const [verificationResult, setVerificationResult] = useState<'valid' | 'invalid' | 'error' | null>(null);
  const [certificateData, setCertificateData] = useState<CertificateVerificationResponse['certificate'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {data: countries} = useQuery<{countries: {id:string;code:string;name:string}[]}>({queryKey: ['/api/public/countries'], enabled: verificationResult === 'valid'});
  const certificateCountry = countries?.countries.find(country => certificateData?.course?.id === `course-${country.id}`);
  const courseTitle = certificateCountry ? `${countryLabel(locale,certificateCountry.code,certificateCountry.name)} — ${courseText(locale,0)}` : certificateData?.course?.title;

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
      setVerificationResult('error');
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
    <div className="min-h-screen bg-background px-4 pb-8 pt-20 flex items-center justify-center [overflow-wrap:anywhere]">
      <div className="absolute top-3 right-3 z-10"><LanguageSwitcher variant="inline" /></div>
      <Card className="w-full max-w-md min-w-0">
        <CardHeader className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">F&S</span>
          </div>
          <CardTitle>{tl("Certificate Verification")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {tl("Enter a certificate code to verify its authenticity")}</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {verificationResult === null && (
            <div className="space-y-4">
              <div className="flex min-w-0 gap-2">
                <Input
                  className="min-w-0" dir="ltr" value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={tl("Enter certificate code (e.g., FAS-ABC123)")}
                  disabled={isLoading}
                  data-testid="input-certificate-code"
                />
                <Button className="shrink-0" aria-label={tl('Verify certificate')} onClick={handleVerify} disabled={isLoading || !code.trim()} data-testid="button-verify">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                {tl("Certificate codes are found on official Find And Study certificates")}</p>
            </div>
          )}

          {verificationResult === 'valid' && certificateData && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-green-700">{tl("Valid Certificate")}</h3>
                <Badge className="mt-1 bg-green-100 text-green-700 hover:bg-green-200">{tl("Verified")}</Badge>
              </div>

              <div className="bg-green-50 rounded-lg p-4 text-start space-y-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-800">{tl("Certificate Details")}</span>
                </div>
                
                <div className="space-y-1 text-sm">
                  <p><strong>{tl("Recipient:")}</strong> {certificateData.user?.name}</p>
                  <p><strong>{tl("Course:")}</strong> {courseTitle || legacyUi('Course content is unavailable.')}</p>
                  <p><strong>{tl("Score:")}</strong> {certificateData.scorePercent}%</p>
                  <p><strong>{tl("Issued:")}</strong> {legacyDate(certificateData.issuedAt,'DD MMM YYYY')}</p>
                  <p><strong>{tl("Code:")}</strong> <bdi dir="ltr">{certificateData.code}</bdi></p>
                </div>
              </div>

              <Button onClick={handleReset} className="w-full whitespace-normal" variant="outline" data-testid="button-verify-another">
                {tl("Verify Another Certificate")}</Button>
            </div>
          )}

          {verificationResult === 'error' && <div role="alert" className="space-y-4"><p>{legacyUi('Request failed')}</p><Button onClick={() => handleVerifyCertificate(code.trim())} className="w-full whitespace-normal" disabled={isLoading}>{tl('Try Again')}</Button></div>}

          {verificationResult === 'invalid' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-red-700">{tl("Invalid Certificate")}</h3>
                <Badge variant="destructive" className="mt-1">{tl("Not Found")}</Badge>
              </div>

              <div className="bg-red-50 rounded-lg p-4 text-start">
                <p className="text-sm text-red-700">
                  {tl('The certificate code {code} could not be verified. This may mean:',{code})}
                </p>
                <ul className="text-sm text-red-600 mt-2 ms-4 list-disc">
                  <li>{tl("The code was entered incorrectly")}</li>
                  <li>{tl("The certificate has been revoked")}</li>
                  <li>{tl("The certificate does not exist")}</li>
                </ul>
              </div>

              <Button onClick={handleReset} className="w-full whitespace-normal" variant="outline" data-testid="button-try-again">
                {tl("Try Again")}</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
