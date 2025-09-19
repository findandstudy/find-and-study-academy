import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Megaphone } from 'lucide-react';

export default function AdminAnnouncements() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Announcements</h1>
        <p className="text-muted-foreground mt-1">
          Manage system announcements and notifications.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Announcement System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Announcement management features will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}