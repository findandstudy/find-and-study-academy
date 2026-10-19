import { legacyUi, legacyStatus } from "@/lib/legacy-ui";
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDataStore } from '@/store/data';
import { useToast } from '@/hooks/use-toast';
import { Bell } from 'lucide-react';

const subscriptionOptions = [
  {
    key: 'enrolled' as const,
    get title(){return legacyUi("Student Enrolled");},
    get description(){return legacyUi("Get notified when a student enrolls in a course through your agency");}
  },
  {
    key: 'fiftyPercent' as const,
    get title(){return legacyUi("50% Progress");},
    get description(){return legacyUi("Get notified when a student reaches 50% course completion");}
  },
  {
    key: 'seventyFivePercent' as const,
    get title(){return legacyUi("75% Progress");},
    get description(){return legacyUi("Get notified when a student reaches 75% course completion");}
  },
  {
    key: 'completed' as const,
    get title(){return legacyUi("Course Completed");},
    get description(){return legacyUi("Get notified when a student successfully completes a course");}
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
      title: legacyUi("Preferences Updated"),
      description: legacyUi("{value0} notifications for {value1}",{value0:legacyStatus(value ? 'Enabled' : 'Disabled'),value1:subscriptionOptions.find(o => o.key === key)?.title})
    });
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {legacyUi("Notification Preferences")}</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {legacyUi("Choose which student progress notifications you'd like to receive.")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            {legacyUi("Student Progress Notifications")}</CardTitle>
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
            {legacyUi("📧 Notifications will be sent to your registered email address. You can change your email preferences in your profile settings.")}</p>
        </CardContent>
      </Card>
    </div>
  );
}