import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth';
import { Shield, Home, ArrowLeft } from 'lucide-react';

export default function Forbidden403() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <div className="text-6xl font-bold text-destructive">403</div>
            <h1 className="text-2xl font-semibold text-foreground">Access Forbidden</h1>
            <p className="text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </div>

          <div className="w-24 h-24 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <Shield className="w-12 h-12 text-destructive" />
          </div>

          <div className="space-y-3">
            {user ? (
              <Link href={user.role === 'admin' ? '/admin/dashboard' : '/agent/dashboard'}>
                <Button className="w-full" data-testid="button-go-dashboard">
                  <Home className="w-4 h-4 mr-2" />
                  Go to My Panel
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button className="w-full" data-testid="button-sign-in">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}