import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/auth';
import { useDataStore } from '@/store/data';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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
  Search,
  Trophy
} from 'lucide-react';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import portalIcon from '@assets/findandstudy-icon_1760222162688.png';
import dormBookingLogo from '@assets/dorm-removebg-preview_1760296726263.png';

interface AgentLayoutProps {
  children: React.ReactNode;
}

const allNavigation = [
  { id: 'dashboard', key: 'nav.dashboard', href: '/agent/dashboard', icon: LayoutDashboard },
  { id: 'courses', key: 'nav.courses', href: '/agent/courses', icon: BookOpen },
  { id: 'certificates', key: 'nav.certificates', href: '/agent/certificates', icon: Award },
  { id: 'leaderboard', key: 'nav.leaderboard', href: '/agent/leaderboard', icon: Trophy },
  { id: 'agency', key: 'nav.myAgency', href: '/agent/agency', icon: Building },
  { id: 'exams-orders', key: 'nav.examsOrders', href: '/agent/exams-orders', icon: ShoppingCart },
  { id: 'subscriptions', key: 'nav.subscriptions', href: '/agent/subscriptions', icon: Bell },
  { id: 'profile', key: 'nav.profile', href: '/agent/profile', icon: User },
  { name: 'Agent Portal', key: 'nav.agentPortal', href: 'https://portal.findandstudy.com/agent-login', customIcon: portalIcon, external: true },
  { name: 'Dorm Booking', key: 'nav.dormBooking', href: 'https://dormbooking.com/', customIcon: dormBookingLogo, external: true },
];

export function AgentLayout({ children }: AgentLayoutProps) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [menuVisibility, setMenuVisibility] = useState<Record<string, boolean>>({});
  const [location] = useLocation();
  const { user, logout } = useAuthStore();
  const { agencies } = useDataStore();
  
  const userAgency = agencies.find(a => a.id === user?.agencyId);

  // Load menu visibility settings
  useEffect(() => {
    const loadMenuVisibility = async () => {
      try {
        const response = await fetch('/api/menu-visibility', {
          headers: {
            'x-user-id': user?.id || '',
            'x-user-role': user?.role || '',
          },
        });

        if (response.ok) {
          const visibility = await response.json();
          setMenuVisibility(visibility);
        }
      } catch (error) {
        console.error('Error loading menu visibility:', error);
      }
    };

    if (user) {
      loadMenuVisibility();
    }
  }, [user]);

  // Filter navigation based on visibility settings
  const navigation = allNavigation.filter(item => {
    // Always show Agent Portal (external link)
    if (item.external) return true;
    
    // Check visibility for other items
    const itemId = (item as any).id;
    return menuVisibility[itemId] !== false; // Show if not explicitly hidden
  });

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
          <div className="flex items-center justify-center h-20 px-4 border-b border-card-border relative">
            <Link href="/agent/dashboard" className="flex-1 flex justify-center">
              {/* Mobile: always show full logo */}
              <img 
                src={logoImage} 
                alt="Find & Study Logo" 
                className="w-36 h-32 rounded object-contain hover-elevate cursor-pointer lg:hidden"
              />
              {/* Desktop: show full logo when expanded, small icon when collapsed */}
              <img 
                src={logoImage} 
                alt="Find & Study Logo" 
                className={`rounded object-contain hover-elevate cursor-pointer hidden lg:block ${sidebarCollapsed ? 'lg:hidden' : 'w-36 h-32'}`}
              />
              <img 
                src={portalIcon} 
                alt="Find & Study" 
                className={`w-10 h-10 rounded object-contain hover-elevate cursor-pointer hidden ${sidebarCollapsed ? 'lg:block' : ''}`}
              />
            </Link>
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
              const displayName = (item as any).key ? t((item as any).key) : item.name;
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
                  {(item as any).customIcon ? (
                    <img 
                      src={(item as any).customIcon} 
                      alt={`${displayName} icon`}
                      className={`h-5 w-5 object-contain ${sidebarCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'}`}
                    />
                  ) : item.icon ? (
                    <item.icon 
                      className={`h-5 w-5 ${sidebarCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'}`}
                      style={(item as any).iconColor ? { 
                        color: (item as any).iconColor, 
                        stroke: (item as any).iconColor,
                        transform: 'rotate(90deg)'
                      } : undefined}
                    />
                  ) : null}
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{displayName}</span>
                </div>
              );

              // External links
              if ((item as any).external) {
                return (
                  <div key={item.name}>
                    {/* Desktop with tooltip when collapsed */}
                    {sidebarCollapsed && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a 
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                            className="hidden lg:block"
                          >
                            {content}
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {displayName}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {/* Mobile and desktop expanded - always visible */}
                    <a 
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                      className={sidebarCollapsed ? 'lg:hidden' : ''}
                    >
                      {content}
                    </a>
                  </div>
                );
              }
              
              // Internal links
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
                        {displayName}
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
                {t('nav.signOut')}
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
                    className="hover:bg-[#ed1c24] hover:text-[#ffffff]"
                    data-testid="button-logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t('nav.signOut')}
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
              Find And Study Academy
            </h1>
          </div>
          
          <LanguageSwitcher />
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}