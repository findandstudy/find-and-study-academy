import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Award } from 'lucide-react';

export default function AdminCertificates() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Certificate Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage and monitor certificate issuance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Certificate System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Certificate management features will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}