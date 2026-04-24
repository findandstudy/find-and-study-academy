import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  Trophy,
  Package,
} from 'lucide-react';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import portalIcon from '@assets/findandstudy-icon_1760222162688.png';
import dormBookingLogo from '@assets/dorm-removebg-preview_1760296726263.png';

interface AgentLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  id?: string;
  name: string;
  href: string;
  icon?: React.ElementType;
  customIcon?: string;
  external?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Logical grouping of navigation
const navigationGroups: NavGroup[] = [
  {
    label: 'Genel',
    items: [
      { id: 'dashboard', name: 'Dashboard', href: '/agent/dashboard', icon: LayoutDashboard },
      { id: 'announcements', name: 'Duyurular', href: '/agent/announcements', icon: Bell },
    ],
  },
  {
    label: 'Eğitim',
    items: [
      { id: 'courses', name: 'Courses', href: '/agent/courses', icon: BookOpen },
      { id: 'certificates', name: 'Certificates', href: '/agent/certificates', icon: Award },
      { id: 'leaderboard', name: 'Leaderboard', href: '/agent/leaderboard', icon: Trophy },
    ],
  },
  {
    label: 'Acente',
    items: [
      { id: 'agency', name: 'My Agency', href: '/agent/agency', icon: Building },
      { id: 'profile', name: 'Profile', href: '/agent/profile', icon: User },
    ],
  },
  {
    label: 'Hizmetler',
    items: [
      { id: 'exams-orders', name: 'Exams/Orders', href: '/agent/exams-orders', icon: ShoppingCart },
      { id: 'subscriptions', name: 'Subscriptions', href: '/agent/subscriptions', icon: Bell },
      { id: 'partner-zone', name: 'Partner Zone', href: '/agent/partner-zone', icon: Package },
    ],
  },
  {
    label: 'Bağlantılar',
    items: [
      { name: 'Agent Portal', href: 'https://portal.findandstudy.com/agent-login', customIcon: portalIcon, external: true },
      { name: 'Dorm Booking', href: 'https://dormbooking.com/', customIcon: dormBookingLogo, external: true },
    ],
  },
];

export function AgentLayout({ children }: AgentLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('agent-sidebar-collapsed') === 'true';
  });
  const [menuVisibility, setMenuVisibility] = useState<Record<string, boolean>>(() => {
    const cached = localStorage.getItem('agent-menu-visibility');
    if (cached) { try { return JSON.parse(cached); } catch { /* ignore */ } }
    return {};
  });
  const [location] = useLocation();
  const { user, logout } = useAuthStore();
  const { agencies } = useDataStore();

  const userAgency = agencies.find(a => a.id === user?.agencyId);

  useEffect(() => {
    localStorage.setItem('agent-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Load menu visibility settings
  useEffect(() => {
    const loadMenuVisibility = async () => {
      try {
        const response = await fetch('/api/menu-visibility', {
          headers: { 'x-user-id': user?.id || '', 'x-user-role': user?.role || '' },
        });
        if (response.ok) {
          const visibility = await response.json();
          setMenuVisibility(visibility);
          localStorage.setItem('agent-menu-visibility', JSON.stringify(visibility));
        }
      } catch (error) {
        console.error('Error loading menu visibility:', error);
      }
    };
    if (user) loadMenuVisibility();
  }, [user]);

  // Filter items in each group based on visibility
  const filterItem = (item: NavItem) => {
    if (item.external) return true;
    if (!item.id) return true;
    if (Object.keys(menuVisibility).length === 0) return false;
    return menuVisibility[item.id] !== false;
  };

  const visibleGroups = navigationGroups
    .map(g => ({ ...g, items: g.items.filter(filterItem) }))
    .filter(g => g.items.length > 0);

  // ─── Item renderer ──────────────────────────────────────────────────────

  const renderItem = (item: NavItem) => {
    const isActive = location === item.href;
    const content = (
      <div
        className={`
          flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover-elevate
          ${sidebarCollapsed ? 'lg:justify-center' : ''}
          ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground'}
        `}
      >
        {item.customIcon ? (
          <img
            src={item.customIcon}
            alt={`${item.name} icon`}
            className={`h-5 w-5 object-contain ${sidebarCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'}`}
          />
        ) : item.icon ? (
          <item.icon className={`h-5 w-5 ${sidebarCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'}`} />
        ) : null}
        <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.name}</span>
      </div>
    );

    const linkProps = {
      'data-testid': `link-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
    };

    const Wrapper = item.external
      ? ({ children, className }: any) => (
          <a href={item.href} target="_blank" rel="noopener noreferrer" className={className} {...linkProps}>
            {children}
          </a>
        )
      : ({ children, className }: any) => (
          <Link href={item.href} className={className} {...linkProps}>
            {children}
          </Link>
        );

    return (
      <div key={item.name}>
        {sidebarCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Wrapper className="hidden lg:block">{content}</Wrapper>
            </TooltipTrigger>
            <TooltipContent side="right">{item.name}</TooltipContent>
          </Tooltip>
        )}
        <Wrapper className={sidebarCollapsed ? 'lg:hidden' : ''}>{content}</Wrapper>
      </div>
    );
  };

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
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-card-border transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header — compact */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-card-border relative shrink-0">
            <Link href="/agent/dashboard" className="flex-1 flex justify-center">
              {/* Mobile / desktop expanded: logo */}
              <img
                src={logoImage}
                alt="Find & Study Logo"
                className={`h-10 w-auto object-contain hover-elevate cursor-pointer ${sidebarCollapsed ? 'lg:hidden' : ''}`}
              />
              {/* Desktop collapsed: small icon */}
              <img
                src={portalIcon}
                alt="Find & Study"
                className={`w-9 h-9 rounded object-contain hover-elevate cursor-pointer hidden ${sidebarCollapsed ? 'lg:block' : ''}`}
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

          {/* Navigation — scrollable, grouped */}
          <nav className="flex-1 overflow-y-auto px-3 py-3">
            {visibleGroups.map((group, idx) => (
              <div key={group.label} className={idx === 0 ? '' : 'mt-3'}>
                {/* Group label (hidden when collapsed) */}
                <div className={`px-3 mb-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                {/* Separator when collapsed */}
                {idx > 0 && sidebarCollapsed && (
                  <div className="hidden lg:block border-t border-border/50 mx-2 my-2" />
                )}
                <div className="space-y-0.5">
                  {group.items.map(renderItem)}
                </div>
              </div>
            ))}
          </nav>

          {/* User section — compact, always visible */}
          <div className="p-3 border-t border-card-border shrink-0">
            {/* Mobile & desktop expanded */}
            <div className={sidebarCollapsed ? 'lg:hidden' : ''}>
              <div className="flex items-center gap-2.5 mb-2">
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={(user as any)?.profilePicture || ''} alt="Profile" />
                  <AvatarFallback className="text-sm font-medium">
                    {user?.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate leading-tight">
                    {user?.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">Agent</Badge>
                    {userAgency && (
                      <span className="text-[11px] text-muted-foreground truncate">{userAgency.name}</span>
                    )}
                  </div>
                </div>
              </div>
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

            {/* Desktop collapsed */}
            <div className={`flex-col items-center space-y-2 ${sidebarCollapsed ? 'hidden lg:flex' : 'hidden'}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={(user as any)?.profilePicture || ''} alt="Profile" />
                    <AvatarFallback className="text-sm font-medium">
                      {user?.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">{user?.name}</TooltipContent>
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
                <TooltipContent side="right">Sign out</TooltipContent>
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
          <div className="w-10 lg:hidden" />
        </div>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
