import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/auth';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Building, 
  Award, 
  BarChart3, 
  Megaphone,
  Settings,
  Plug,
  User,
  LogOut,
  Menu,
  X,
  ListTree
} from 'lucide-react';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import portalIcon from '@assets/findandstudy-icon_1760222162688.png';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Profile', href: '/admin/profile', icon: User },
  { name: 'Content/Countries', href: '/admin/content/countries', icon: FileText },
  { name: 'Quizzes', href: '/admin/quizzes', icon: Award },
  { name: 'Certificates', href: '/admin/certificates', icon: Award },
  { name: 'Agencies', href: '/admin/agencies', icon: Building },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
  { name: 'Announcements', href: '/admin/announcements', icon: Megaphone },
  { name: 'Settings/Payments', href: '/admin/settings/payments', icon: Settings },
  { name: 'Integrations', href: '/admin/integrations', icon: Plug },
  { name: 'Menu Management', href: '/admin/menu-management', icon: ListTree },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuthStore();

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
        fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-card-border transform transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-card-border relative">
            {/* Mobile: always show full header */}
            <div className="flex items-center space-x-2 lg:hidden">
              <img 
                src={logoImage} 
                alt="Find & Study Logo" 
                className="w-8 h-8 rounded object-contain"
              />
              <span className="font-semibold text-foreground">Admin Panel</span>
            </div>
            {/* Desktop: adapt based on collapsed state */}
            <div className={`items-center space-x-2 ${sidebarCollapsed ? 'hidden' : 'hidden lg:flex'}`}>
              <img 
                src={logoImage} 
                alt="Find & Study Logo" 
                className="w-8 h-8 rounded object-contain"
              />
              <span className="font-semibold text-foreground">Admin Panel</span>
            </div>
            <img 
              src={portalIcon} 
              alt="Find & Study" 
              className={`w-10 h-10 rounded object-contain ${sidebarCollapsed ? 'hidden lg:block' : 'hidden'}`}
            />
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden absolute right-2"
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
                  ${sidebarCollapsed ? 'lg:justify-center' : ''}
                  ${isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  }
                `}>
                  <item.icon className={`h-5 w-5 ${sidebarCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'}`} />
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.name}</span>
                </div>
              );

              return (
                <div key={item.name}>
                  {/* Desktop with tooltip when collapsed */}
                  {sidebarCollapsed && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={item.href} className="hidden lg:block">
                          {content}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Mobile and desktop expanded - always visible */}
                  <Link href={item.href} className={sidebarCollapsed ? 'lg:hidden' : ''}>
                    {content}
                  </Link>
                </div>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-card-border">
            {/* Mobile & Desktop expanded: full user info */}
            <div className={sidebarCollapsed ? 'lg:hidden' : ''}>
              <div className="flex items-center space-x-3 mb-4">
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
                  <Badge variant="default" className="text-xs">Admin</Badge>
                </div>
              </div>
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
            
            {/* Desktop collapsed: icon only */}
            <div className={`flex-col items-center space-y-3 ${sidebarCollapsed ? 'hidden lg:flex' : 'hidden'}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={(user as any)?.profilePicture || ''} alt="Profile Picture" />
                    <AvatarFallback className="text-sm font-medium">
                      {user?.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {user?.name}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={logout}
                    data-testid="button-logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Sign out
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between bg-background border-b border-border px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-open-sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              data-testid="button-toggle-sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">
              Find And Study - Admin Portal
            </h1>
          </div>
          
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