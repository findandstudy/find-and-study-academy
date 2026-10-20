import { legacyUi } from "@/lib/legacy-ui";
import {usePublicUi} from '@/lib/public-ui';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { publicEmailHref } from '@/lib/email-attribution';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import backgroundImage from '@assets/portal-background.png';

interface AuthCardProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  variant?: 'signup';
}

export function AuthCard({ children, title, description, variant }: AuthCardProps) {
  const {tl}=usePublicUi();
  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative ${variant === 'signup' ? 'py-16 sm:py-12 bg-slate-50 isolate' : ''}`}
      style={variant === 'signup' ? undefined : { backgroundImage: `url(${backgroundImage})` }}
    >
      {variant === 'signup' && <>
        <aside className="pointer-events-none absolute inset-y-0 left-0 hidden xl:flex flex-col justify-center items-center gap-4 px-5 text-center" style={{width:'min(320px, calc((100% - 680px) / 2))'}}>
          <a href={publicEmailHref('/')} data-testid="link-auth-decoration-home" className="pointer-events-auto inline-block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><img src={logoImage} alt={legacyUi("Find & Study")} className="w-56 max-w-full h-auto" /></a>
          <p className="text-primary font-semibold text-lg break-words">{tl('home.heroBadge')}</p>
        </aside>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden xl:block" style={{width:'calc((100% - 680px) / 2)', backgroundImage:`url(${backgroundImage})`, backgroundSize:'auto 100%', backgroundPosition:'right center', backgroundRepeat:'no-repeat'}} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-primary xl:hidden" />
        <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-40 w-5 rounded-bl-full bg-red-600 xl:hidden" />
      </>}
      {/* Language picker — top-right corner so unauthenticated users can pick before signing in */}
      <div className="absolute top-3 right-3 z-10">
        <div className="rounded-md backdrop-blur-sm bg-background/80 px-1">
          <LanguageSwitcher variant="inline" />
        </div>
      </div>

      <Card className={`relative w-full backdrop-blur-sm bg-background/95 ${variant === 'signup' ? 'max-w-[640px] bg-white shadow-sm' : 'max-w-md'}`}>
        <CardHeader className="space-y-0 text-center pt-3 pb-1">
          <div className="mb-2">
            <a href={publicEmailHref('/')} data-testid="link-auth-home" className="inline-block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <img
              src={logoImage}
              alt={legacyUi("Find & Study Logo")}
              className={`${variant === 'signup' ? 'w-40 h-12' : 'w-64 h-64'} mx-auto rounded-md object-contain`}
            />
            </a>
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
