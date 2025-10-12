import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Home, Search } from 'lucide-react';

export default function NotFound404() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <div className="text-6xl font-bold text-primary">404</div>
            <h1 className="text-2xl font-semibold text-foreground">{t('error.404.title')}</h1>
            <p className="text-muted-foreground">
              {t('error.404.message')}
            </p>
          </div>

          <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Search className="w-12 h-12 text-muted-foreground" />
          </div>

          <div className="space-y-3">
            <Link href="/">
              <Button className="w-full" data-testid="button-go-home">
                <Home className="w-4 h-4 mr-2" />
                {t('error.404.goHome')}
              </Button>
            </Link>
            
            <Link href="/login">
              <Button variant="outline" className="w-full" data-testid="button-sign-in">
                {t('error.404.signIn')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}