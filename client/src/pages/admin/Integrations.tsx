import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Plug } from 'lucide-react';

export default function AdminIntegrations() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Manage third-party integrations and API connections.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5" />
            Integration Hub
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Integration management features will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}