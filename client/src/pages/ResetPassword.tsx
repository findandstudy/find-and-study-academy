import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from '@/components/layouts/AuthCard';
import { CheckCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Extract token from URL query params
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    
    if (!tokenParam) {
      setError('Invalid or missing reset token');
    } else {
      setToken(tokenParam);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      toast({
        title: 'Success',
        description: 'Your password has been reset successfully',
      });

      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
      toast({
        title: 'Error',
        description: err.message || 'Failed to reset password',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthCard
        title="Password Reset Successful"
        description="Your password has been updated"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
          </div>

          <Link href="/login">
            <Button className="w-full" data-testid="button-go-to-login">
              Go to Sign In
            </Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (!token && error) {
    return (
      <AuthCard
        title="Invalid Reset Link"
        description="This password reset link is invalid or has expired"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {error}
            </p>
          </div>

          <Link href="/forgot-password">
            <Button className="w-full" data-testid="button-request-new-link">
              Request New Reset Link
            </Button>
          </Link>

          <Link href="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset Password"
      description="Enter your new password"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm" data-testid="error-message">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            required
            minLength={6}
            disabled={isLoading}
            data-testid="input-new-password"
          />
          <p className="text-xs text-muted-foreground">
            Must be at least 6 characters long
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            minLength={6}
            disabled={isLoading}
            data-testid="input-confirm-password"
          />
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading}
          data-testid="button-reset-password"
        >
          {isLoading ? 'Resetting Password...' : 'Reset Password'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/login">
          <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer">
            <ArrowLeft className="w-3 h-3 inline mr-1" />
            Back to Sign In
          </span>
        </Link>
      </div>
    </AuthCard>
  );
}
