import { legacyUi, legacyDate, legacyMessage } from "@/lib/legacy-ui";
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { useCourseDirectory } from '@/lib/use-course-directory';
import { generateCertificatePDF, generateBadgePNG } from '@/lib/pdf';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Award, Download, FileDown, Calendar, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AgentCertificates() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { directory } = useCourseDirectory();
  const { toast } = useToast();

  // Fetch certificates from backend
  const { data: certificatesResponse, isLoading, isError, refetch } = useQuery<{ success: boolean; certificates: any[] }>({
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
      // Prefer localized API-directory metadata, retaining historical server metadata.
      const courseId = certificate.courseId ?? certificate.course?.id;
      const course = directory.get(courseId) || certificate.course;
      
      // Retain localized metadata, but reject an unresolved or mismatched ID.
      if (!course || typeof course.id !== 'string' || course.id !== courseId
        || typeof course.title !== 'string' || !course.title.trim()) {
        throw new Error(legacyUi('Course content is unavailable.'));
      }

      // Convert to full course object for PDF generation
      // Use agency from backend certificate response
      await generateCertificatePDF(
        certificate, 
        user, 
        { ...course, sections: [] } as any,
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
        description: error instanceof Error ? legacyMessage(error.message) : t('agent.certificates.toast.downloadFailedDescription'),
        variant: 'destructive'
      });
    }
  };

  const downloadBadge = async (certificateCode?: string) => {
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
      await generateBadgePNG(user, certificateCode || 'FAS-AGENT');
      toast({
        title: t('agent.certificates.toast.badgeDownloaded'),
        description: t('agent.certificates.toast.badgeDownloadedDescription')
      });
    } catch (error) {
      console.error('Badge generation error:', error);
      toast({
        title: t('agent.certificates.toast.downloadFailed'),
        description: error instanceof Error ? legacyMessage(error.message) : t('agent.certificates.toast.badgeError'),
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-w-0 space-y-8 [overflow-wrap:anywhere]">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-8 border border-primary/10">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative">
          <h1 className="text-3xl sm:text-4xl font-bold break-words bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {t('agent.certificates.title')}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {t('agent.certificates.subtitle')}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card className="min-h-64 flex items-center justify-center p-6">
          <div className="text-center">
            <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
            <p className="text-muted-foreground">{t('agent.certificates.loading')}</p>
          </div>
        </Card>
      ) : isError ? (<Card><CardContent className="space-y-4 p-6" role="alert"><p>{legacyUi("Request failed")}</p><Button onClick={() => refetch()} className="whitespace-normal">{legacyUi("Try Again")}</Button></CardContent></Card>) : userCertificates.length === 0 ? (
        <Card className="min-h-64 flex items-center justify-center p-6">
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
              // Resolve the same course identity used for PDF generation.
              const course = directory.get(certificate.courseId ?? certificate.course?.id) || certificate.course;
              return (
                <Card key={certificate.id} className="min-w-0 hover-elevate">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Award className="w-8 h-8 shrink-0 text-primary" />
                      <Badge variant="default" className="max-w-full whitespace-normal bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{t('agent.certificates.certified')}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold">{course?.title || legacyUi('Course content is unavailable.')}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t('agent.certificates.code', { code: '⁨'+certificate.code+'⁩' })}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                      <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
                        <TrendingUp className="w-4 h-4 shrink-0" />
                        {t('agent.certificates.score', { score: certificate.scorePercent })}
                      </div>
                      <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
                        <Calendar className="w-4 h-4 shrink-0" />
                        {legacyDate(certificate.issuedAt,'DD MMM YYYY')}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm" className="min-w-0 whitespace-normal py-2"
                        onClick={() => downloadCertificate(certificate.id)}
                        data-testid={`button-download-cert-${certificate.id}`}
                      >
                        <Download className="w-4 h-4 shrink-0" />
                        {t('agent.certificates.pdf')}
                      </Button>
                      <Button
                        size="sm" className="min-w-0 whitespace-normal py-2"
                        variant="outline"
                        onClick={() => downloadBadge(certificate.code)}
                        data-testid={`button-download-badge-${certificate.id}`}
                      >
                        <FileDown className="w-4 h-4 shrink-0" />
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
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-medium">{t('agent.certificates.certifiedAgent')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('agent.certificates.downloadAgentBadge')}
                  </p>
                </div>
                <Button 
                  onClick={() => downloadBadge(userCertificates[userCertificates.length - 1]?.code || 'FAS-AGENT')} 
                  className="max-w-full whitespace-normal" data-testid="button-download-agent-badge"
                >
                  <FileDown className="w-4 h-4 shrink-0" />
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
