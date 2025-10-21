import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from '@/components/layouts/AuthCard';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset email');
      }

      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
      toast({
        title: 'Error',
        description: err.message || 'Failed to send reset email',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthCard
        title="Check Your Email"
        description="We've sent a password reset link to your email"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              If an account with that email exists, a password reset link has been sent to:
            </p>
            <p className="font-medium">{email}</p>
          </div>

          <div className="bg-muted rounded-lg p-4 text-left">
            <p className="text-sm text-muted-foreground">
              Please check your email inbox (and spam folder) for the reset link. 
              The link will expire in 1 hour for security reasons.
            </p>
          </div>

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
      title="Forgot Password"
      description="Enter your email to receive a reset link"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm" data-testid="error-message">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            required
            autoComplete="email"
            disabled={isLoading}
            data-testid="input-email"
          />
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading}
          data-testid="button-submit"
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Remember your password?{' '}
          <Link href="/login">
            <span className="text-primary hover:underline cursor-pointer">
              Sign In
            </span>
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}