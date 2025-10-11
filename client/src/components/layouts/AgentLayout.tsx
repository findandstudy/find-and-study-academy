import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
  X,
  Search
} from 'lucide-react';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import portalIcon from '@assets/findandstudy-icon_1760222162688.png';

interface AgentLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/agent/dashboard', icon: LayoutDashboard },
  { name: 'Courses', href: '/agent/courses', icon: BookOpen },
  { name: 'Certificates', href: '/agent/certificates', icon: Award },
  { name: 'My Agency', href: '/agent/agency', icon: Building },
  { name: 'Exams/Orders', href: '/agent/exams-orders', icon: ShoppingCart },
  { name: 'Subscriptions', href: '/agent/subscriptions', icon: Bell },
  { name: 'Profile', href: '/agent/profile', icon: User },
  { name: 'Agent Portal', href: 'https://portal.findandstudy.com/agent-login', customIcon: portalIcon, external: true },
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
          <div className="flex items-center justify-between h-24 px-6 border-b border-card-border">
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
              const content = (
                <div className={`
                  flex items-center px-3 py-2 text-sm font-medium rounded-md hover-elevate transition-colors
                  ${isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  }
                `}>
                  {(item as any).customIcon ? (
                    <img 
                      src={(item as any).customIcon} 
                      alt={`${item.name} icon`}
                      className="mr-3 h-5 w-5 object-contain"
                    />
                  ) : item.icon ? (
                    <item.icon 
                      className="mr-3 h-5 w-5" 
                      style={(item as any).iconColor ? { 
                        color: (item as any).iconColor, 
                        stroke: (item as any).iconColor,
                        transform: 'rotate(90deg)'
                      } : undefined}
                    />
                  ) : null}
                  {item.name}
                </div>
              );
              
              if ((item as any).external) {
                return (
                  <a 
                    key={item.name} 
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {content}
                  </a>
                );
              }
              
              return (
                <Link key={item.name} href={item.href}>
                  {content}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-card-border">
            <div className="flex items-center space-x-3 mb-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={(user as any)?.profilePicture || ''} alt="Profile Picture" />
                <AvatarFallback className="text-sm font-medium">
                  {user?.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
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
              className="w-full hover:bg-[#ed1c24] hover:text-[#ffffff] hover:border-[#ed1c24]"
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
            Find And Study Academy
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