import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from '@/components/layouts/AuthCard';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Login() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const success = await login({ email, password });
    if (success) {
      // Role-based redirect happens in App.tsx after login
      const session = useAuthStore.getState();
      if (session.role === 'admin') {
        setLocation('/admin/dashboard');
      } else {
        setLocation('/agent/dashboard');
      }
    } else {
      toast({
        title: t('common.error'),
        description: 'Invalid email or password. Please try again.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <AuthCard
        title={t('auth.welcome')}
        description={t('auth.signInDescription')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email')}
              required
              autoComplete="email"
              data-testid="input-email"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password')}
              required
              autoComplete="current-password"
              data-testid="input-password"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
            data-testid="button-submit"
          >
            {isLoading ? t('common.loading') : t('auth.login')}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link href="/signup">
              <span className="text-primary hover:underline cursor-pointer">
                {t('auth.signup')}
              </span>
            </Link>
          </p>
          
          <p className="text-sm text-muted-foreground">
            <Link href="/forgot-password">
              <span className="text-primary hover:underline cursor-pointer">
                {t('auth.forgotPassword')}
              </span>
            </Link>
          </p>
        </div>
      </AuthCard>
    </div>
  );
}