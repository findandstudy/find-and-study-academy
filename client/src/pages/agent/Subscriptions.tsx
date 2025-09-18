import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDataStore } from '@/store/data';
import { useToast } from '@/hooks/use-toast';
import { Bell } from 'lucide-react';

const subscriptionOptions = [
  {
    key: 'enrolled' as const,
    title: 'Student Enrolled',
    description: 'Get notified when a student enrolls in a course through your agency'
  },
  {
    key: 'fiftyPercent' as const,
    title: '50% Progress',
    description: 'Get notified when a student reaches 50% course completion'
  },
  {
    key: 'seventyFivePercent' as const,
    title: '75% Progress',
    description: 'Get notified when a student reaches 75% course completion'
  },
  {
    key: 'completed' as const,
    title: 'Course Completed',
    description: 'Get notified when a student successfully completes a course'
  }
];

export default function AgentSubscriptions() {
  const { subscriptionPreferences, updateSubscriptionPreferences } = useDataStore();
  const { toast } = useToast();

  const updatePreference = (key: keyof typeof subscriptionPreferences, value: boolean) => {
    const newPreferences = {
      ...subscriptionPreferences,
      [key]: value
    };
    
    updateSubscriptionPreferences(newPreferences);
    
    toast({
      title: 'Preferences Updated',
      description: `${value ? 'Enabled' : 'Disabled'} notifications for ${subscriptionOptions.find(o => o.key === key)?.title}`
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Notification Preferences</h1>
        <p className="text-muted-foreground mt-1">
          Choose which student progress notifications you'd like to receive.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Student Progress Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {subscriptionOptions.map((option) => (
            <div key={option.key} className="flex items-start justify-between py-4 border-b last:border-b-0">
              <div className="flex-1">
                <Label htmlFor={option.key} className="text-base font-medium cursor-pointer">
                  {option.title}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {option.description}
                </p>
              </div>
              <Switch
                id={option.key}
                checked={subscriptionPreferences[option.key]}
                onCheckedChange={(checked) => updatePreference(option.key, checked)}
                data-testid={`switch-${option.key}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            📧 Notifications will be sent to your registered email address. 
            You can change your email preferences in your profile settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}