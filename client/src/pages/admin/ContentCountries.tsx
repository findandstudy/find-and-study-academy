import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function AdminContentCountries() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Content & Countries</h1>
        <p className="text-muted-foreground mt-1">
          Manage course content and country-specific materials.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Content Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Content management features will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}