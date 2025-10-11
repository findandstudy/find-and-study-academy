import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { BookOpen, Award, Users, TrendingUp, Bell } from 'lucide-react';
import { Link } from 'wouter';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import { announcementTypeStyles, announcementPriorityVariants } from '@/lib/announcement-helpers';

export default function AgentDashboard() {
  const { user } = useAuthStore();
  const { courses, progresses, certificates, announcements } = useDataStore();

  // Calculate user progress
  const userProgress = progresses.filter(p => p.userId === user?.id);
  const userCertificates = certificates.filter(c => c.userId === user?.id);
  
  // Filter announcements: published, for agents or all, and not expired
  const activeAnnouncements = announcements.filter(a => {
    const isPublished = a.status === 'published';
    const isTargeted = a.targetAudience === 'all' || a.targetAudience === 'agents';
    const notExpired = !a.expiresAt || new Date(a.expiresAt) > new Date();
    return isPublished && isTargeted && notExpired;
  });

  // Mock stats for demo //todo: remove mock functionality
  const stats = [
    {
      title: 'Courses Enrolled',
      value: courses.length,
      icon: BookOpen,
      change: '+2 this month'
    },
    {
      title: 'Certificates Earned',
      value: userCertificates.length,
      icon: Award,
      change: 'Latest: Turkey Course'
    },
    {
      title: 'Students Helped',
      value: 45, // Mock data
      icon: Users,
      change: '+12 this month'
    },
    {
      title: 'Success Rate',
      value: '94%',
      icon: TrendingUp,
      change: '+2% from last month'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
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
          Track your progress and continue your agent training journey.
        </p>
      </div>

      {/* Announcements */}
      {activeAnnouncements.length > 0 && (
        <div className="space-y-3" data-testid="section-announcements">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-primary" data-testid="icon-announcements" />
            <h2 className="text-lg font-semibold text-foreground" data-testid="heading-announcements">Announcements</h2>
          </div>
          {activeAnnouncements.map(announcement => {
            const style = announcementTypeStyles[announcement.type];
            const IconComponent = style.icon;
            
            return (
              <Card 
                key={announcement.id} 
                className={`${style.bg} border ${style.border}`}
                data-testid={`card-announcement-${announcement.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${style.iconColor}`} data-testid={`icon-announcement-type-${announcement.type}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground" data-testid={`text-announcement-title-${announcement.id}`}>
                          {announcement.title}
                        </h3>
                        <Badge 
                          variant={announcementPriorityVariants[announcement.priority] as any} 
                          className="text-xs"
                          data-testid={`badge-announcement-priority-${announcement.id}`}
                        >
                          {announcement.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid={`text-announcement-content-${announcement.id}`}>
                        {announcement.content}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Course Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Course Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {courses.map(course => {
              const progress = userProgress.find(p => p.courseId === course.id);
              const progressPercent = progress?.percent || 0;
              
              return (
                <div key={course.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{course.title}</h3>
                    <Badge variant={progressPercent === 100 ? 'default' : 'secondary'}>
                      {progressPercent}%
                    </Badge>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {progress?.lessonCompletedIds.length || 0} lessons completed
                    </span>
                    <Link href="/agent/courses">
                      <Button size="sm" variant="outline" data-testid={`button-view-course-${course.id}`}>
                        {progressPercent > 0 ? 'Continue' : 'Start'}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Recent Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userCertificates.length > 0 ? (
              <div className="space-y-3">
                {userCertificates.slice(-3).map(cert => {
                  const course = courses.find(c => c.id === cert.courseId);
                  return (
                    <div key={cert.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <div>
                        <p className="font-medium">{course?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Score: {cert.scorePercent}% • {new Date(cert.issuedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="default">Certified</Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No certificates yet</p>
                <p className="text-sm text-muted-foreground">Complete courses to earn certificates</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}