import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from '@/components/layouts/AuthCard';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { useToast } from '@/hooks/use-toast';

export default function Signup() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    agencyName: '',
    country: ''
  });
  const { signup, isLoading } = useAuthStore();
  const { initialize: initializeData } = useDataStore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const success = await signup(formData);
    if (success) {
      // Reload data store to include newly created agency
      initializeData();
      
      toast({
        title: 'Account Created',
        description: 'Welcome to Find And Study! Redirecting to your dashboard...'
      });
      setLocation('/agent/dashboard');
    } else {
      toast({
        title: 'Signup Failed',
        description: 'There was an error creating your account. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <AuthCard
      title="Create Agent Account"
      description="Join Find And Study as a certified agent"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Your full name"
            required
            autoComplete="name"
            data-testid="input-name"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="Your email address"
            required
            autoComplete="email"
            data-testid="input-email"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => updateField('password', e.target.value)}
            placeholder="Create a password"
            required
            autoComplete="new-password"
            data-testid="input-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="agencyName">Agency Name</Label>
          <Input
            id="agencyName"
            type="text"
            value={formData.agencyName}
            onChange={(e) => updateField('agencyName', e.target.value)}
            placeholder="Your education agency name"
            required
            autoComplete="organization"
            data-testid="input-agency"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            type="text"
            value={formData.country}
            onChange={(e) => updateField('country', e.target.value)}
            placeholder="Your country"
            required
            autoComplete="country-name"
            data-testid="input-country"
          />
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading}
          data-testid="button-submit"
        >
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
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