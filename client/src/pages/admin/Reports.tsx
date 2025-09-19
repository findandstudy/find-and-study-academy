import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function AdminReports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">
          View system analytics and generate reports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Analytics Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Reports and analytics features will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}