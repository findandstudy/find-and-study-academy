import { Card, CardHeader, CardContent } from '@/components/ui/card';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import backgroundImage from '@assets/portal-background.png';

interface AuthCardProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AuthCard({ children, title, description }: AuthCardProps) {
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <Card className="w-full max-w-md backdrop-blur-sm bg-background/95">
        <CardHeader className="space-y-1 text-center pt-4 pb-2">
          <div className="mb-2">
            <img 
              src={logoImage} 
              alt="Find & Study Logo" 
              className="w-64 h-64 mx-auto rounded-md object-contain"
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