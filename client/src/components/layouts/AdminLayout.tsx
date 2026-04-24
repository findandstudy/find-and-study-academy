import { useState, useEffect } from 'react';
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
  ListTree,
  Bot,
  Package,
} from 'lucide-react';
import logoImage from '@assets/Find and Study Logo-01_1758200859271.png';
import portalIcon from '@assets/findandstudy-icon_1760222162688.png';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
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
      { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'Profile', href: '/admin/profile', icon: User },
    ],
  },
  {
    label: 'İçerik',
    items: [
      { name: 'Content/Countries', href: '/admin/content/countries', icon: FileText },
      { name: 'Quizzes', href: '/admin/quizzes', icon: Award },
      { name: 'Certificates', href: '/admin/certificates', icon: Award },
      { name: 'Partner Zone', href: '/admin/partner-zone', icon: Package },
    ],
  },
  {
    label: 'Yönetim',
    items: [
      { name: 'Agencies', href: '/admin/agencies', icon: Building },
      { name: 'Users', href: '/admin/users', icon: Users },
      { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Etkileşim',
    items: [
      { name: 'Announcements', href: '/admin/announcements', icon: Megaphone },
      { name: 'Findy AI', href: '/admin/findy-ai', icon: Bot },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { name: 'Settings/Payments', href: '/admin/settings/payments', icon: Settings, adminOnly: true },
      { name: 'Integrations', href: '/admin/integrations', icon: Plug, adminOnly: true },
      { name: 'Menu Management', href: '/admin/menu-management', icon: ListTree, adminOnly: true },
    ],
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('admin-sidebar-collapsed') === 'true';
  });
  const [location] = useLocation();
  const { user, role, logout } = useAuthStore();

  // Filter groups based on role — staff cannot see admin-only items
  const visibleGroups = navigationGroups
    .map(g => ({ ...g, items: g.items.filter(it => !it.adminOnly || role === 'admin') }))
    .filter(g => g.items.length > 0);

  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
        <item.icon className={`h-5 w-5 ${sidebarCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'}`} />
        <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.name}</span>
      </div>
    );

    return (
      <div key={item.name}>
        {sidebarCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={item.href} className="hidden lg:block">{content}</Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.name}</TooltipContent>
          </Tooltip>
        )}
        <Link href={item.href} className={sidebarCollapsed ? 'lg:hidden' : ''}>
          {content}
        </Link>
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
          {/* Header */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-card-border relative shrink-0">
            <div className={`items-center ${sidebarCollapsed ? 'flex lg:hidden' : 'flex'}`}>
              <img
                src={logoImage}
                alt="Find & Study Logo"
                className="h-9 w-auto object-contain"
              />
            </div>
            <img
              src={portalIcon}
              alt="Find & Study"
              className={`w-9 h-9 object-contain ${sidebarCollapsed ? 'hidden lg:block' : 'hidden'}`}
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

          {/* User section — compact */}
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
                  <Badge variant="default" className="text-[10px] py-0 px-1.5 h-4 mt-0.5">
                    {role === 'admin' ? 'Admin' : 'Staff'}
                  </Badge>
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
                  <Button variant="ghost" size="icon" onClick={logout} data-testid="button-logout">
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
              Find And Study - Admin Portal
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
