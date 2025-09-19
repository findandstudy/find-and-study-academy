import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Building } from 'lucide-react';

export default function AdminAgencies() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Agency Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage partner agencies and their agents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Agency Directory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Agency management features will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}