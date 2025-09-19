import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function AdminSettingsPayments() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings & Payments</h1>
        <p className="text-muted-foreground mt-1">
          Configure system settings and payment options.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            System Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Settings and payment management features will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}