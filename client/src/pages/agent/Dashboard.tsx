import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { BookOpen, Award, Users, TrendingUp, Bell, Calendar, Flame, Clock, CheckCircle2 } from 'lucide-react';
import { Link } from 'wouter';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import { announcementTypeStyles, announcementPriorityVariants } from '@/lib/announcement-helpers';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Announcement } from '@/types';

export default function AgentDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { courses } = useDataStore(); // Only get courses from localStorage (static data)
  
  // Fetch progress from backend API
  const { data: progressData } = useQuery<{ success: boolean; progresses: any[] }>({
    queryKey: ['/api/progress'],
    enabled: !!user,
  });
  
  // Fetch certificates from backend API
  const { data: certificatesData } = useQuery<{ success: boolean; certificates: any[] }>({
    queryKey: ['/api/certificates'],
    enabled: !!user,
  });

  // Fetch real weekly activity from analytics
  const { data: activityData } = useQuery<{ success: boolean; activity: { day: string; date: string; lessons: number }[] }>({
    queryKey: ['/api/analytics/my-activity'],
    enabled: !!user,
  });
  
  // Fetch announcements from backend
  const { data: announcementsData } = useQuery<{ success: boolean; announcements: Announcement[] }>({
    queryKey: ['/api/announcements'],
    enabled: !!user,
  });
  
  const progresses = progressData?.progresses || [];
  const certificates = certificatesData?.certificates || [];
  const announcements = announcementsData?.announcements || [];
  
  // Track certificates for re-render (debugging)
  useEffect(() => {
    console.log('[DASHBOARD] Certificates from backend:', certificates.length, certificates);
  }, [certificates]);

  // Calculate user progress (no filter needed - backend already filters by user)
  const userProgress = progresses;
  const userCertificates = certificates;
  
  // Backend already filters announcements (published, targeted, not expired)
  const activeAnnouncements = announcements;

  // Calculate real statistics
  const enrolledCourses = userProgress.length;
  const completedCourses = userProgress.filter(p => p.percent === 100).length;
  const totalLessonsCompleted = userProgress.reduce((sum, p) => sum + p.lessonCompletedIds.length, 0);
  const avgScore = userCertificates.length > 0
    ? Math.round(userCertificates.reduce((sum, c) => sum + c.scorePercent, 0) / userCertificates.length)
    : 0;
  
  // Calculate learning activity based on user progress
  const inProgressCourses = userProgress.filter(p => p.percent > 0 && p.percent < 100).length;
  
  const stats = [
    {
      key: 'courses-in-progress',
      title: t('agent.dashboard.stats.coursesInProgress'),
      value: enrolledCourses,
      icon: BookOpen,
      change: t('agent.dashboard.stats.coursesInProgressChange', { completed: completedCourses, active: inProgressCourses }),
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      key: 'certificates-earned',
      title: t('agent.dashboard.stats.certificatesEarned'),
      value: userCertificates.length,
      icon: Award,
      change: avgScore > 0 ? t('agent.dashboard.stats.avgScore', { score: avgScore }) : t('agent.dashboard.stats.completeToEarn'),
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10'
    },
    {
      key: 'lessons-completed',
      title: t('agent.dashboard.stats.lessonsCompleted'),
      value: totalLessonsCompleted,
      icon: CheckCircle2,
      change: enrolledCourses > 0 ? t('agent.dashboard.stats.acrossCourses', { count: enrolledCourses }) : t('agent.dashboard.stats.startLearning'),
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      key: 'overall-progress',
      title: t('agent.dashboard.stats.overallProgress'),
      value: enrolledCourses > 0 ? `${Math.round(userProgress.reduce((sum, p) => sum + p.percent, 0) / enrolledCourses)}%` : '0%',
      icon: TrendingUp,
      change: t('agent.dashboard.stats.coursesDone', { done: completedCourses, total: enrolledCourses }),
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    }
  ];
  
  // Course completion data for bar chart
  const courseCompletionData = courses
    .map(course => {
      const progress = userProgress.find(p => p.courseId === course.id);
      return {
        name: course.title.length > 15 ? course.title.substring(0, 15) + '...' : course.title,
        progress: progress?.percent || 0,
        enrolled: !!progress
      };
    })
    .sort((a, b) => b.progress - a.progress); // Sort by progress descending
  
  // Real weekly activity data from analytics API
  const weeklyProgressData = activityData?.activity || Array.from({ length: 7 }, (_, i) => ({
    day: dayjs().subtract(6 - i, 'day').format('ddd'),
    date: dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD'),
    lessons: 0,
  }));

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
            {t('agent.dashboard.welcome', { name: user?.name })}
          </h1>
        </div>
        <p className="text-muted-foreground mt-1">
          {t('agent.dashboard.subtitle')}
        </p>
      </div>

      {/* Announcements */}
      {activeAnnouncements.length > 0 && (
        <div className="space-y-3" data-testid="section-announcements">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" data-testid="icon-announcements" />
              <h2 className="text-lg font-semibold text-foreground" data-testid="heading-announcements">{t('agent.dashboard.announcementsTitle')}</h2>
            </div>
            <Link href="/agent/announcements">
              <Button variant="ghost" size="sm" data-testid="button-view-all-announcements">
                {t('agent.dashboard.viewAllAnnouncements', { count: activeAnnouncements.length })}
              </Button>
            </Link>
          </div>
          {activeAnnouncements.slice(0, 3).map(announcement => {
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
                          variant={announcementPriorityVariants[announcement.priority]} 
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
          <Card key={stat.key} className="hover-elevate" data-testid={`card-stat-${stat.key}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground" data-testid={`text-stat-value-${stat.key}`}>
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
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {t('agent.dashboard.weeklyActivity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={weeklyProgressData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="lessons" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.6}
                  name={t('agent.dashboard.lessonsSeries')}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Course Progress Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              {t('agent.dashboard.courseProgressOverview')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={courseCompletionData}>
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
                <Bar 
                  dataKey="progress" 
                  fill="hsl(var(--primary))" 
                  radius={[8, 8, 0, 0]}
                  name={t('agent.dashboard.progressSeries')}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline & Recent Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t('agent.dashboard.recentActivity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userCertificates.slice(-3).reverse().map((cert, index) => {
                const course = courses.find(c => c.id === cert.courseId);
                return (
                  <div key={cert.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Award className="w-4 h-4 text-primary" />
                      </div>
                      {index < 2 && <div className="w-px h-full bg-border mt-2" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-sm">{t('agent.dashboard.certificateEarned')}</p>
                      <p className="text-sm text-muted-foreground">{course?.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dayjs(cert.issuedAt).format('MMM D, YYYY • h:mm A')}
                      </p>
                    </div>
                  </div>
                );
              })}
              {userProgress.filter(p => p.lessonCompletedIds.length > 0).slice(-2).reverse().map((progress, index) => {
                const course = courses.find(c => c.id === progress.courseId);
                return (
                  <div key={progress.userId + progress.courseId} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-blue-500" />
                      </div>
                      {index < 1 && <div className="w-px h-full bg-border mt-2" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-sm">{t('agent.dashboard.courseProgress')}</p>
                      <p className="text-sm text-muted-foreground">{course?.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('agent.dashboard.lessonsAndPercent', { lessons: progress.lessonCompletedIds.length, percent: progress.percent })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {userCertificates.length === 0 && userProgress.length === 0 && (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('agent.dashboard.noActivity')}</p>
                  <p className="text-sm text-muted-foreground">{t('agent.dashboard.noActivityHint')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              {t('agent.dashboard.recentAchievements')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userCertificates.length > 0 ? (
              <div className="space-y-3">
                {userCertificates.slice(-3).map(cert => {
                  const course = courses.find(c => c.id === cert.courseId);
                  return (
                    <div key={cert.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover-elevate">
                      <div>
                        <p className="font-medium">{course?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('agent.dashboard.scoreAndDate', { score: cert.scorePercent, date: dayjs(cert.issuedAt).format('MMM D, YYYY') })}
                        </p>
                      </div>
                      <Badge variant="default">{t('agent.dashboard.certified')}</Badge>
                    </div>
                  );
                })}
                <Link href="/agent/certificates">
                  <Button variant="outline" className="w-full mt-2" data-testid="button-view-all-certificates">
                    {t('agent.dashboard.viewAllCertificates')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('agent.dashboard.noCertificatesYet')}</p>
                <p className="text-sm text-muted-foreground">{t('agent.dashboard.completeToEarnCerts')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Course Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            {t('agent.dashboard.detailedCourseProgress')}
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
                    {t('agent.dashboard.lessonsCompletedSimple', { count: progress?.lessonCompletedIds.length || 0 })}
                  </span>
                  <Link href="/agent/courses">
                    <Button size="sm" variant="outline" data-testid={`button-view-course-${course.id}`}>
                      {progressPercent > 0 ? t('common.continue') : t('common.start')}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}