import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from '@/components/layouts/AuthCard';
import { CheckCircle, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock email submission
    setIsSubmitted(true);
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
              A password reset link has been sent to:
            </p>
            <p className="font-medium">{email}</p>
          </div>

          <div className="bg-muted rounded-lg p-4 text-left">
            <p className="text-sm text-muted-foreground">
              <strong>Demo Note:</strong> This is a demonstration. In a real application, 
              you would receive an actual email with a secure reset link.
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
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            required
            data-testid="input-email"
          />
        </div>

        <Button type="submit" className="w-full" data-testid="button-submit">
          Send Reset Link
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