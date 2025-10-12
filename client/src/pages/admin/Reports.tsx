import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, Award, BookOpen, Building2, TrendingUp, Target, Download, FileText, Table } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import jsPDF from 'jspdf';
import { useDataStore } from '@/store/data';
import dayjs from 'dayjs';

interface AnalyticsOverview {
  totalUsers: number;
  totalCertificates: number;
  totalAttempts: number;
  totalAgencies: number;
  certificatesThisMonth: number;
  averageScore: number;
  passRate: number;
}

interface AnalyticsCharts {
  userRoles: { name: string; value: number }[];
  certificateMonthly: { month: string; certificates: number }[];
  agencyCountries: { country: string; agencies: number }[];
  quizPerformance: { attempt: number; score: number }[];
  scoreDistribution: { range: string; count: number }[];
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function AdminReports() {
  const { users, certificates, progresses, agencies, courses } = useDataStore();
  
  // Fetch analytics data
  const { data: overviewData, isLoading: overviewLoading } = useQuery<{ success: boolean; overview: AnalyticsOverview }>({
    queryKey: ['/api/admin/analytics/overview'],
    staleTime: 60000, // 1 minute
  });

  const { data: chartsData, isLoading: chartsLoading } = useQuery<{ success: boolean; charts: AnalyticsCharts }>({
    queryKey: ['/api/admin/analytics/charts'],
    staleTime: 60000, // 1 minute
  });

  const overview = overviewData?.overview;
  const charts = chartsData?.charts;
  const isLoading = overviewLoading || chartsLoading;
  
  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Title
    doc.setFontSize(20);
    doc.text('Find And Study - Analytics Report', pageWidth / 2, 20, { align: 'center' });
    
    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${dayjs().format('MMMM D, YYYY HH:mm')}`, pageWidth / 2, 30, { align: 'center' });
    
    let yPos = 45;
    
    // Overview Statistics
    if (overview) {
      doc.setFontSize(14);
      doc.text('Overview Statistics', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      doc.text(`Total Users: ${overview.totalUsers}`, 20, yPos);
      yPos += 7;
      doc.text(`Total Certificates: ${overview.totalCertificates}`, 20, yPos);
      yPos += 7;
      doc.text(`Quiz Attempts: ${overview.totalAttempts}`, 20, yPos);
      yPos += 7;
      doc.text(`Active Agencies: ${overview.totalAgencies}`, 20, yPos);
      yPos += 15;
      
      doc.setFontSize(14);
      doc.text('Performance Metrics', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      doc.text(`Certificates This Month: ${overview.certificatesThisMonth}`, 20, yPos);
      yPos += 7;
      doc.text(`Average Quiz Score: ${overview.averageScore}%`, 20, yPos);
      yPos += 7;
      doc.text(`Pass Rate: ${overview.passRate}%`, 20, yPos);
      yPos += 15;
    }
    
    // Course Enrollment Data
    doc.setFontSize(14);
    doc.text('Course Enrollment Summary', 20, yPos);
    yPos += 10;
    
    courses.forEach(course => {
      const enrollments = progresses.filter(p => p.courseId === course.id);
      const completed = enrollments.filter(p => p.percent === 100).length;
      
      doc.setFontSize(10);
      doc.text(`${course.title}: ${enrollments.length} enrolled, ${completed} completed`, 25, yPos);
      yPos += 7;
      
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }
    });
    
    // Certificate Score Distribution
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }
    
    yPos += 10;
    doc.setFontSize(14);
    doc.text('Certificate Score Distribution', 20, yPos);
    yPos += 10;
    
    const scoreRanges = [
      { range: '90-100%', min: 90, max: 100 },
      { range: '80-89%', min: 80, max: 89 },
      { range: '70-79%', min: 70, max: 79 },
      { range: '<70%', min: 0, max: 69 }
    ];
    
    scoreRanges.forEach(range => {
      const count = certificates.filter(c => c.scorePercent >= range.min && c.scorePercent <= range.max).length;
      doc.setFontSize(10);
      doc.text(`${range.range}: ${count} certificates`, 25, yPos);
      yPos += 7;
    });
    
    // Top Performing Agents
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }
    
    yPos += 10;
    doc.setFontSize(14);
    doc.text('Top 5 Performing Agents', 20, yPos);
    yPos += 10;
    
    const agents = users.filter(u => u.role === 'agent');
    const topAgents = agents.map(agent => {
      const agentProgress = progresses.filter(p => p.userId === agent.id);
      const completedCourses = agentProgress.filter(p => p.percent === 100).length;
      const agentCerts = certificates.filter(c => c.userId === agent.id);
      const avgProgress = agentProgress.length > 0
        ? Math.round(agentProgress.reduce((sum, p) => sum + p.percent, 0) / agentProgress.length)
        : 0;
      
      return { name: agent.name, completedCourses, certificates: agentCerts.length, avgProgress };
    }).sort((a, b) => b.avgProgress - a.avgProgress).slice(0, 5);
    
    topAgents.forEach((agent, index) => {
      doc.setFontSize(10);
      doc.text(`${index + 1}. ${agent.name}: ${agent.avgProgress}% avg, ${agent.completedCourses} courses, ${agent.certificates} certs`, 25, yPos);
      yPos += 7;
    });
    
    // Footer
    doc.setFontSize(8);
    doc.text(`Report generated on ${dayjs().format('MMMM D, YYYY at HH:mm')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('Find And Study - Agent Training Platform', pageWidth / 2, pageHeight - 5, { align: 'center' });
    
    // Save PDF
    doc.save(`analytics-report-${dayjs().format('YYYY-MM-DD')}.pdf`);
  };
  
  // Export to CSV
  const exportToCSV = () => {
    const agents = users.filter(u => u.role === 'agent');
    
    // Create CSV content
    let csvContent = 'Agent Name,Email,Agency,Courses Enrolled,Completed Courses,Certificates,Average Progress\n';
    
    agents.forEach(agent => {
      const agentProgress = progresses.filter(p => p.userId === agent.id);
      const completedCourses = agentProgress.filter(p => p.percent === 100).length;
      const agentCerts = certificates.filter(c => c.userId === agent.id).length;
      const avgProgress = agentProgress.length > 0
        ? Math.round(agentProgress.reduce((sum, p) => sum + p.percent, 0) / agentProgress.length)
        : 0;
      const agency = agencies.find(a => a.id === agent.agencyId);
      
      csvContent += `"${agent.name}","${agent.email}","${agency?.name || 'N/A'}",${agentProgress.length},${completedCourses},${agentCerts},${avgProgress}%\n`;
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `agent-analytics-${dayjs().format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Loading analytics data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-heading">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive system analytics and performance insights.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={exportToCSV} 
            variant="outline" 
            className="gap-2"
            data-testid="button-export-csv"
          >
            <Table className="w-4 h-4" />
            Export CSV
          </Button>
          <Button 
            onClick={exportToPDF} 
            variant="outline" 
            className="gap-2"
            data-testid="button-export-pdf"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Overview Statistics */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold" data-testid="text-total-users">{overview.totalUsers}</p>
                </div>
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Certificates</p>
                  <p className="text-2xl font-bold" data-testid="text-total-certificates">{overview.totalCertificates}</p>
                </div>
                <Award className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Quiz Attempts</p>
                  <p className="text-2xl font-bold" data-testid="text-total-attempts">{overview.totalAttempts}</p>
                </div>
                <BookOpen className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Agencies</p>
                  <p className="text-2xl font-bold" data-testid="text-total-agencies">{overview.totalAgencies}</p>
                </div>
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Metrics */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Certificates This Month</p>
                  <p className="text-2xl font-bold" data-testid="text-monthly-certificates">{overview.certificatesThisMonth}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Average Quiz Score</p>
                  <p className="text-2xl font-bold" data-testid="text-average-score">{overview.averageScore}%</p>
                </div>
                <BarChart3 className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pass Rate</p>
                  <p className="text-2xl font-bold" data-testid="text-pass-rate">{overview.passRate}%</p>
                </div>
                <Target className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      {charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Role Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Role Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64" data-testid="chart-user-roles">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.userRoles}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {charts.userRoles.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Certificate Issuance Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Certificate Issuance (6 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64" data-testid="chart-certificates-monthly">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.certificateMonthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="certificates" stroke={COLORS[0]} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Agency Distribution by Country */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Agencies by Country
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64" data-testid="chart-agencies-countries">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.agencyCountries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="country" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="agencies" fill={COLORS[1]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quiz Performance Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Recent Quiz Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64" data-testid="chart-quiz-performance">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.quizPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="attempt" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                    <Line type="monotone" dataKey="score" stroke={COLORS[2]} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Score Distribution */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Score Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64" data-testid="chart-score-distribution">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill={COLORS[3]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}