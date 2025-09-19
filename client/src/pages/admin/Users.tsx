import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function AdminUsers() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage users, roles, and permissions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Directory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            User management features will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}