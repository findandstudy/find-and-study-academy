import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { generateCertificatePDF, generateBadgePNG } from '@/lib/pdf';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Award, Download, FileDown, Calendar, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AgentCertificates() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { courses, agencies } = useDataStore();
  const { toast } = useToast();

  // Fetch certificates from backend
  const { data: certificatesResponse, isLoading } = useQuery<{ success: boolean; certificates: any[] }>({
    queryKey: ['/api/certificates'],
    enabled: !!user
  });

  // Always use backend certificates (no localStorage fallback)
  const certificates = certificatesResponse?.certificates || [];
  const userCertificates = certificates.filter(c => c.userId === user?.id);

  const downloadCertificate = async (certificateId: string) => {
    const certificate = certificates.find(c => c.id === certificateId);
    if (!certificate || !user) return;

    try {
      // Use course from backend (certificate.course) or fetch from API
      let course = certificate.course;
      
      if (!course) {
        // Try localStorage first
        const localCourse = courses.find(c => c.id === certificate.courseId);
        if (localCourse) {
          course = {
            id: localCourse.id,
            title: localCourse.title,
            slug: localCourse.slug
          };
        }
      }

      // If still no course, fetch from backend
      if (!course) {
        const response = await fetch('/api/courses');
        const data = await response.json();
        if (data.success && data.courses) {
          const backendCourse = data.courses.find((c: any) => c.id === certificate.courseId);
          if (backendCourse) {
            course = {
              id: backendCourse.id,
              title: backendCourse.title,
              slug: backendCourse.slug
            };
          }
        }
      }

      // If course not found, use placeholder data to still generate certificate
      const courseData = course || {
        id: certificate.courseId,
        title: 'Find And Study Agent Training',
        slug: 'agent-training'
      };

      // Convert to full course object for PDF generation
      // Use agency from backend certificate response
      await generateCertificatePDF(
        certificate, 
        user, 
        { ...courseData, sections: [] } as any,
        certificate.agency || null
      );
      toast({
        title: t('agent.certificates.toast.certificateDownloaded'),
        description: t('agent.certificates.toast.certificateDownloadedDescription')
      });
    } catch (error) {
      console.error('Certificate PDF generation error:', error);
      toast({
        title: t('agent.certificates.toast.downloadFailed'),
        description: error instanceof Error ? error.message : t('agent.certificates.toast.downloadFailedDescription'),
        variant: 'destructive'
      });
    }
  };

  const downloadBadge = (certificateCode?: string) => {
    if (!user) {
      toast({
        title: t('agent.certificates.toast.downloadFailed'),
        description: t('agent.certificates.toast.userNotFound'),
        variant: 'destructive'
      });
      return;
    }
    
    try {
      // Badge generation doesn't need course information, just user and code
      generateBadgePNG(user, certificateCode || 'FAS-AGENT');
      toast({
        title: t('agent.certificates.toast.badgeDownloaded'),
        description: t('agent.certificates.toast.badgeDownloadedDescription')
      });
    } catch (error) {
      console.error('Badge generation error:', error);
      toast({
        title: t('agent.certificates.toast.downloadFailed'),
        description: error instanceof Error ? error.message : t('agent.certificates.toast.badgeError'),
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
            {t('agent.certificates.title')}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {t('agent.certificates.subtitle')}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card className="h-64 flex items-center justify-center">
          <div className="text-center">
            <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
            <p className="text-muted-foreground">{t('agent.certificates.loading')}</p>
          </div>
        </Card>
      ) : userCertificates.length === 0 ? (
        <Card className="h-64 flex items-center justify-center">
          <div className="text-center">
            <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">{t('agent.certificates.noCertificatesYet')}</p>
            <p className="text-sm text-muted-foreground">{t('agent.certificates.completeToEarn')}</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Certificates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userCertificates.map(certificate => {
              // Use course from backend or fallback to localStorage
              const course = certificate.course || courses.find(c => c.id === certificate.courseId);
              return (
                <Card key={certificate.id} className="hover-elevate">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <Award className="w-8 h-8 text-primary" />
                      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{t('agent.certificates.certified')}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold">{course?.title || t('agent.certificates.courseTitleFallback')}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t('agent.certificates.code', { code: certificate.code })}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        {t('agent.certificates.score', { score: certificate.scorePercent })}
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
                        {t('agent.certificates.pdf')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadBadge(certificate.code)}
                        data-testid={`button-download-badge-${certificate.id}`}
                      >
                        <FileDown className="w-4 h-4 mr-1" />
                        {t('agent.certificates.badge')}
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
              <CardTitle>{t('agent.certificates.agentBadge')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('agent.certificates.certifiedAgent')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('agent.certificates.downloadAgentBadge')}
                  </p>
                </div>
                <Button 
                  onClick={() => downloadBadge(userCertificates[userCertificates.length - 1]?.code || 'FAS-AGENT')} 
                  data-testid="button-download-agent-badge"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  {t('agent.certificates.downloadBadge')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}