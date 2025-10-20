import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { generateCertificatePDF, generateBadgePNG } from '@/lib/pdf';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Award, Download, FileDown, Calendar, TrendingUp } from 'lucide-react';

export default function AgentCertificates() {
  const { user } = useAuthStore();
  const { certificates: localCertificates, courses, agencies } = useDataStore();
  const { toast } = useToast();

  // Fetch certificates from backend
  const { data: certificatesResponse, isLoading } = useQuery<{ success: boolean; certificates: any[] }>({
    queryKey: ['/api/certificates'],
    enabled: !!user
  });

  // Use backend certificates if available, fallback to localStorage
  const backendCertificates = certificatesResponse?.certificates || [];
  const certificates = backendCertificates.length > 0 ? backendCertificates : localCertificates;
  
  const userCertificates = certificates.filter(c => c.userId === user?.id);
  const userAgency = agencies.find(a => a.id === user?.agencyId);

  const downloadCertificate = async (certificateId: string) => {
    const certificate = certificates.find(c => c.id === certificateId);
    if (!certificate || !user) return;

    const course = courses.find(c => c.id === certificate.courseId);
    if (!course) return;

    try {
      await generateCertificatePDF(certificate, user, course, userAgency || null);
      toast({
        title: 'Certificate Downloaded',
        description: 'Your certificate has been downloaded successfully.'
      });
    } catch (error) {
      console.error('Certificate PDF generation error:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'There was an error downloading your certificate.',
        variant: 'destructive'
      });
    }
  };

  const downloadBadge = (certificateCode: string) => {
    if (!user) return;
    
    try {
      generateBadgePNG(user, certificateCode);
      toast({
        title: 'Badge Downloaded',
        description: 'Your agent badge has been downloaded successfully.'
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'There was an error downloading your badge.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            My Certificates
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Download and manage your earned certificates and agent badges.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card className="h-64 flex items-center justify-center">
          <div className="text-center">
            <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading certificates...</p>
          </div>
        </Card>
      ) : userCertificates.length === 0 ? (
        <Card className="h-64 flex items-center justify-center">
          <div className="text-center">
            <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No certificates yet</p>
            <p className="text-sm text-muted-foreground">Complete courses to earn certificates</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Certificates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userCertificates.map(certificate => {
              const course = courses.find(c => c.id === certificate.courseId);
              return (
                <Card key={certificate.id} className="hover-elevate">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <Award className="w-8 h-8 text-primary" />
                      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Certified</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold">{course?.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Certificate Code: {certificate.code}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        Score: {certificate.scorePercent}%
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(certificate.issuedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={() => downloadCertificate(certificate.id)}
                        data-testid={`button-download-cert-${certificate.id}`}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadBadge(certificate.code)}
                        data-testid={`button-download-badge-${certificate.id}`}
                      >
                        <FileDown className="w-4 h-4 mr-1" />
                        Badge
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Agent Badge Section */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Badge</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Certified Find And Study Agent</p>
                  <p className="text-sm text-muted-foreground">
                    Download your agent badge with your latest certificate code
                  </p>
                </div>
                <Button 
                  onClick={() => downloadBadge(userCertificates[userCertificates.length - 1]?.code || 'FAS-AGENT')} 
                  data-testid="button-download-agent-badge"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Download Badge
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}