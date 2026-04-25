import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { announcementTypeStyles, announcementPriorityVariants } from '@/lib/announcement-helpers';
import dayjs from 'dayjs';
import type { Announcement } from '@/types';
import { useTranslation } from 'react-i18next';

export default function AgentAnnouncements() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery<{ success: boolean; announcements: Announcement[] }>({
    queryKey: ['/api/announcements'],
    enabled: !!user,
  });
  const announcements = data?.announcements ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/agent/dashboard">
          <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="heading-announcements-page">
              {t('agent.announcements.title')}
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('agent.announcements.subtitle')}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center" data-testid="empty-announcements">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('agent.announcements.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const style = announcementTypeStyles[a.type] || announcementTypeStyles.info;
            const Icon = style.icon;
            const dateStr = a.publishedAt || a.createdAt;
            return (
              <Card
                key={a.id}
                className={`${style.bg} ${style.border} border`}
                data-testid={`card-announcement-${a.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${style.iconColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="font-semibold text-foreground" data-testid={`text-title-${a.id}`}>
                          {a.title}
                        </h2>
                        <Badge
                          variant={announcementPriorityVariants[a.priority]}
                          className="text-xs"
                        >
                          {a.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {a.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {dayjs(dateStr).format('DD MMM YYYY HH:mm')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
