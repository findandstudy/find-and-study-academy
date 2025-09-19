import { Card, CardHeader, CardContent } from '@/components/ui/card';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';

interface AuthCardProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AuthCard({ children, title, description }: AuthCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4">
            <img 
              src={logoImage} 
              alt="Find & Study Logo" 
              className="w-12 h-12 mx-auto rounded-md object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}