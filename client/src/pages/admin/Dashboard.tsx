import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useDataStore } from '@/store/data';
import { useAuthStore } from '@/store/auth';
import { Users, Award, Building, Megaphone, TrendingUp, BookOpen, Target } from 'lucide-react';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import dayjs from 'dayjs';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const { users, certificates, agencies, announcements, progresses, courses } = useDataStore();

  const agents = users.filter(u => u.role === 'agent');
  const activeAnnouncements = announcements.filter(a => 
    a.status === 'published' && 
    (!a.expiresAt || new Date(a.expiresAt) > new Date())
  );
  
  // Analytics calculations
  const totalAgents = agents.length;
  const totalCertificates = certificates.length;
  const activeAgencies = agencies.length; // All agencies are considered active in frontend type
  
  // Course completion rate
  const totalEnrollments = progresses.length;
  const completedCourses = progresses.filter(p => p.percent === 100).length;
  const completionRate = totalEnrollments > 0 ? Math.round((completedCourses / totalEnrollments) * 100) : 0;
  
  // Average score across all certificates
  const avgCertificateScore = totalCertificates > 0
    ? Math.round(certificates.reduce((sum, c) => sum + c.scorePercent, 0) / totalCertificates)
    : 0;

  const stats = [
    {
      title: 'Total Agents',
      value: totalAgents,
      icon: Users,
      change: `${agencies.length} agencies registered`,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Certificates Issued',
      value: totalCertificates,
      icon: Award,
      change: `Avg score: ${avgCertificateScore}%`,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10'
    },
    {
      title: 'Course Completion Rate',
      value: `${completionRate}%`,
      icon: Target,
      change: `${completedCourses}/${totalEnrollments} completed`,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Active Announcements',
      value: activeAnnouncements.length,
      icon: Megaphone,
      change: 'Currently active',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    }
  ];
  
  // Course enrollment data for charts
  const courseEnrollmentData = courses.map(course => {
    const enrollments = progresses.filter(p => p.courseId === course.id);
    const completed = enrollments.filter(p => p.percent === 100).length;
    return {
      name: course.title.length > 20 ? course.title.substring(0, 20) + '...' : course.title,
      enrolled: enrollments.length,
      completed: completed,
      inProgress: enrollments.length - completed
    };
  }).filter(d => d.enrolled > 0); // Only show courses with enrollments
  
  // Certificate distribution by score
  const scoreRanges = [
    { range: '90-100%', min: 90, max: 100, count: 0, color: '#10b981' },
    { range: '80-89%', min: 80, max: 89, count: 0, color: '#3b82f6' },
    { range: '70-79%', min: 70, max: 79, count: 0, color: '#f59e0b' },
    { range: '<70%', min: 0, max: 69, count: 0, color: '#ef4444' }
  ];
  
  certificates.forEach(cert => {
    const range = scoreRanges.find(r => cert.scorePercent >= r.min && cert.scorePercent <= r.max);
    if (range) range.count++;
  });
  
  const scoreDistributionData = scoreRanges.filter(r => r.count > 0);
  
  // Agent progress overview - calculate for all agents, then sort and slice
  const agentProgressData = agents.map(agent => {
    const agentProgress = progresses.filter(p => p.userId === agent.id);
    const avgProgress = agentProgress.length > 0
      ? Math.round(agentProgress.reduce((sum, p) => sum + p.percent, 0) / agentProgress.length)
      : 0;
    const agentCerts = certificates.filter(c => c.userId === agent.id);
    
    return {
      name: agent.name.length > 15 ? agent.name.substring(0, 15) + '...' : agent.name,
      progress: avgProgress,
      certificates: agentCerts.length,
      enrolled: agentProgress.length
    };
  }).sort((a, b) => b.progress - a.progress).slice(0, 10); // Sort first, then take top 10

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Avatar className="w-10 h-10">
            <AvatarImage src={(user as any)?.profilePicture || ''} alt="Profile Picture" />
            <AvatarFallback className="text-sm font-medium">
              {user?.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.name}!
          </h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Manage the Find And Study platform and monitor agent activities.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover-elevate" data-testid={`card-admin-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground" data-testid={`text-admin-stat-value-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`w-12 h-12 ${stat.bgColor} rounded-full flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Course Enrollment Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Course Enrollment & Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            {courseEnrollmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={courseEnrollmentData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="completed" stackId="a" fill="hsl(var(--primary))" name="Completed" />
                  <Bar dataKey="inProgress" stackId="a" fill="hsl(var(--chart-2))" name="In Progress" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No enrollment data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Certificate Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Certificate Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scoreDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={scoreDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ range, count }) => `${range}: ${count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {scoreDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No certificate data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performers & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Top Performing Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agentProgressData.slice(0, 5).map((agent, index) => (
                <div key={agent.name} className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover-elevate">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary text-sm font-bold">
                        #{index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {agent.enrolled} courses • {agent.certificates} certificates
                      </p>
                    </div>
                  </div>
                  <Badge variant="default">{agent.progress}%</Badge>
                </div>
              ))}
              {agentProgressData.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No agent activity yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Platform Status</span>
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Total Enrollments</span>
              <Badge variant="secondary">{totalEnrollments}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Total Agencies</span>
              <Badge variant="secondary">{agencies.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Completion Rate</span>
              <Badge variant={completionRate >= 70 ? 'default' : 'secondary'}>
                {completionRate}%
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Avg Certificate Score</span>
              <Badge variant={avgCertificateScore >= 80 ? 'default' : 'secondary'}>
                {avgCertificateScore}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}