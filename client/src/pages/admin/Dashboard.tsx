import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useDataStore } from '@/store/data';
import { useAuthStore } from '@/store/auth';
import { Users, Award, Building, Megaphone } from 'lucide-react';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const { users, certificates, agencies, announcements } = useDataStore();

  const agents = users.filter(u => u.role === 'agent');
  const activeAnnouncements = announcements.filter(a => a.active);

  const stats = [
    {
      title: 'Total Agents',
      value: agents.length,
      icon: Users,
      change: '+2 this month'
    },
    {
      title: 'Certificates Issued',
      value: certificates.length,
      icon: Award,
      change: '+5 this week'
    },
    {
      title: 'Active Agencies',
      value: agencies.length,
      icon: Building,
      change: 'All verified'
    },
    {
      title: 'Active Announcements',
      value: activeAnnouncements.length,
      icon: Megaphone,
      change: 'Currently active'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Avatar className="w-10 h-10">
            <AvatarImage src={(user as any)?.profilePicture || ''} alt="Profile Picture" />
            <AvatarFallback className="text-sm font-medium">
              {user?.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.name}!
          </h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Manage the Find And Study platform and monitor agent activities.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover-elevate">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Agent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agents.slice(0, 5).map(agent => (
                <div key={agent.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground text-sm font-medium">
                        {agent.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">{agent.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Active</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Platform Status</span>
              <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Database</span>
              <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                Healthy
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Integrations</span>
              <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                Pending Setup
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Payments</span>
              <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                Disabled
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}