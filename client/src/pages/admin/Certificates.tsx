import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { generateCertificatePDF } from '@/lib/pdf';
import { 
  Award, 
  Search, 
  Eye,
  Download,
  Calendar,
  Users,
  TrendingUp,
  CheckCircle,
  BookOpen,
  Filter,
  BarChart3
} from 'lucide-react';

interface AdminCertificate {
  id: string;
  code: string;
  scorePercent: number;
  issuedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  course: {
    id: string;
    title: string;
    slug: string;
  } | null;
}

export default function AdminCertificates() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [selectedCertificate, setSelectedCertificate] = useState<AdminCertificate | null>(null);

  // Fetch all certificates for admin
  const { data: certificatesData, isLoading: certificatesLoading } = useQuery({
    queryKey: ['/api/admin/certificates'],
    select: (data: any) => data.certificates as AdminCertificate[]
  });

  const certificates = certificatesData || [];

  // Filter certificates based on search and course filter
  const filteredCertificates = certificates.filter(cert => {
    const matchesSearch = !searchQuery || 
      cert.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.course?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCourse = filterCourse === 'all' || cert.course?.id === filterCourse;
    
    return matchesSearch && matchesCourse;
  });

  // Calculate statistics
  const stats = {
    total: certificates.length,
    thisMonth: certificates.filter(cert => {
      const certDate = new Date(cert.issuedAt);
      const thisMonth = new Date();
      thisMonth.setDate(1);
      return certDate >= thisMonth;
    }).length,
    averageScore: certificates.length > 0 
      ? Math.round(certificates.reduce((sum, cert) => sum + cert.scorePercent, 0) / certificates.length)
      : 0,
    uniqueUsers: new Set(certificates.map(cert => cert.user?.id).filter(Boolean)).size
  };

  // Get unique courses for filter
  const uniqueCourses = Array.from(
    new Set(certificates.map(cert => cert.course).filter(Boolean).map(c => c!.id))
  ).map(courseId => certificates.find(cert => cert.course?.id === courseId)?.course!);

  const openCertificateDetails = (certificate: AdminCertificate) => {
    setSelectedCertificate(certificate);
  };

  const downloadCertificate = async (certificate: AdminCertificate) => {
    try {
      if (!certificate.user || !certificate.course) {
        toast({
          title: 'Download Failed',
          description: 'Certificate data is incomplete.',
          variant: 'destructive'
        });
        return;
      }

      // Convert AdminCertificate to types expected by generateCertificatePDF
      await generateCertificatePDF(
        {
          id: certificate.id,
          code: certificate.code,
          scorePercent: certificate.scorePercent,
          issuedAt: certificate.issuedAt,
          userId: certificate.user.id,
          courseId: certificate.course.id
        },
        {
          id: certificate.user.id,
          name: certificate.user.name,
          email: certificate.user.email,
          role: certificate.user.role as 'agent' | 'admin',
          agencyId: undefined
        },
        {
          id: certificate.course.id,
          title: certificate.course.title,
          slug: certificate.course.slug,
          sections: []
        },
        null // agency - not available in admin view
      );

      toast({
        title: 'Certificate Downloaded',
        description: `Certificate ${certificate.code} downloaded successfully.`
      });
    } catch (error) {
      console.error('Certificate download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download certificate.',
        variant: 'destructive'
      });
    }
  };

  if (certificatesLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Certificate Management</h1>
          <p className="text-muted-foreground mt-1">Loading certificates...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-certificates-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Certificate Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage and monitor all issued certificates across the platform.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="stat-total-certificates">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Certificates</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Award className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-this-month">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">{stats.thisMonth}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-average-score">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold">{stats.averageScore}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-unique-users">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Certified Users</p>
                <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
              </div>
              <Users className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Certificate Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by certificate code, user name, email, or course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-certificates"
              />
            </div>
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="w-full sm:w-64" data-testid="select-filter-course">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {uniqueCourses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Certificates List */}
          {filteredCertificates.length === 0 ? (
            <div className="text-center py-12">
              <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No certificates found</h3>
              <p className="text-muted-foreground">
                {searchQuery || filterCourse !== 'all' 
                  ? 'Try adjusting your search or filter criteria.' 
                  : 'No certificates have been issued yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCertificates.map((certificate) => (
                <Card key={certificate.id} className="hover-elevate" data-testid={`certificate-card-${certificate.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="font-mono text-sm font-semibold text-foreground">
                              {certificate.code}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {certificate.scorePercent}% Score
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Student</p>
                            <p className="font-medium">{certificate.user?.name || 'Unknown User'}</p>
                            <p className="text-xs text-muted-foreground">{certificate.user?.email}</p>
                          </div>
                          
                          <div>
                            <p className="text-muted-foreground">Course</p>
                            <p className="font-medium flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {certificate.course?.title || 'Unknown Course'}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-muted-foreground">Issued</p>
                            <p className="font-medium">
                              {new Date(certificate.issuedAt).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(certificate.issuedAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openCertificateDetails(certificate)}
                              data-testid={`button-view-certificate-${certificate.id}`}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Certificate Details</DialogTitle>
                            </DialogHeader>
                            {selectedCertificate && (
                              <div className="space-y-4">
                                <div className="text-center">
                                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
                                    <Award className="w-8 h-8 text-blue-600" />
                                  </div>
                                  <h3 className="text-lg font-semibold">{selectedCertificate.course?.title}</h3>
                                  <p className="text-sm text-muted-foreground">Certificate of Completion</p>
                                </div>
                                
                                <Separator />
                                
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Certificate Code</p>
                                    <p className="font-mono text-sm">{selectedCertificate.code}</p>
                                  </div>
                                  
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Student</p>
                                    <p>{selectedCertificate.user?.name}</p>
                                    <p className="text-xs text-muted-foreground">{selectedCertificate.user?.email}</p>
                                  </div>
                                  
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Final Score</p>
                                    <p className="text-lg font-semibold text-green-600">
                                      {selectedCertificate.scorePercent}%
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Issue Date</p>
                                    <p>{new Date(selectedCertificate.issuedAt).toLocaleString()}</p>
                                  </div>
                                </div>
                                
                                <Button 
                                  onClick={() => downloadCertificate(selectedCertificate)}
                                  className="w-full"
                                  data-testid="button-download-certificate"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Download Certificate
                                </Button>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}