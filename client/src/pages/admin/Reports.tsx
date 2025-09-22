import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, Award, BookOpen, Building2, TrendingUp, Target } from 'lucide-react';
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
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-heading">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive system analytics and performance insights.
        </p>
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