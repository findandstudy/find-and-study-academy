import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import backgroundImage from '@assets/portal-background.png';

interface AuthCardProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  variant?: 'signup';
}

export function AuthCard({ children, title, description, variant }: AuthCardProps) {
  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative ${variant === 'signup' ? 'py-14 sm:py-10' : ''}`}
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Language picker — top-right corner so unauthenticated users can pick before signing in */}
      <div className="absolute top-3 right-3 z-10">
        <div className="rounded-md backdrop-blur-sm bg-background/80 px-1">
          <LanguageSwitcher variant="inline" />
        </div>
      </div>

      <Card className={`w-full backdrop-blur-sm bg-background/95 ${variant === 'signup' ? 'max-w-3xl' : 'max-w-md'}`}>
        <CardHeader className="space-y-0 text-center pt-3 pb-1">
          <div className="mb-2">
            <img
              src={logoImage}
              alt="Find & Study Logo"
              className={`${variant === 'signup' ? 'w-40 h-12' : 'w-64 h-64'} mx-auto rounded-md object-contain`}
            />
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-sm mt-1">{description}</p>
          )}
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}