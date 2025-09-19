import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { 
  LayoutDashboard, 
  BookOpen, 
  Award, 
  User, 
  Building, 
  ShoppingCart,
  Bell,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';

interface AgentLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/agent/dashboard', icon: LayoutDashboard },
  { name: 'Courses', href: '/agent/courses', icon: BookOpen },
  { name: 'Certificates', href: '/agent/certificates', icon: Award },
  { name: 'Profile', href: '/agent/profile', icon: User },
  { name: 'My Agency', href: '/agent/agency', icon: Building },
  { name: 'Exams/Orders', href: '/agent/exams-orders', icon: ShoppingCart },
  { name: 'Subscriptions', href: '/agent/subscriptions', icon: Bell },
];

export function AgentLayout({ children }: AgentLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuthStore();
  const { agencies } = useDataStore();
  
  const userAgency = agencies.find(a => a.id === user?.agencyId);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-card-border transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-40 px-6 border-b border-card-border">
            <Link href="/agent/dashboard" className="flex-1 flex justify-center">
              <img 
                src={logoImage} 
                alt="Find & Study Logo" 
                className="w-36 h-36 rounded object-contain hover-elevate cursor-pointer"
              />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden absolute right-6"
              onClick={() => setSidebarOpen(false)}
              data-testid="button-close-sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-md hover-elevate transition-colors
                    ${isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                    }
                  `}>
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-card-border">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-medium">
                  {user?.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.name}
                </p>
                <Badge variant="secondary" className="text-xs">Agent</Badge>
              </div>
            </div>
            {userAgency && (
              <p className="text-xs text-muted-foreground mb-4 px-2">
                {userAgency.name}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="w-full"
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between bg-background border-b border-border px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-open-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <h1 className="text-lg font-semibold text-foreground">
            Find And Study - Agents Portal
          </h1>
          
          <div className="w-10 lg:hidden" /> {/* Spacer for mobile */}
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}