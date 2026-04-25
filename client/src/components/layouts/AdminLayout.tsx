import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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
  /** i18n key under `nav.items.*` */
  i18nKey: string;
  /** Fallback label if a translation is missing */
  fallback: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

interface NavGroup {
  /** i18n key under `nav.groups.*` */
  i18nKey: string;
  fallback: string;
  items: NavItem[];
}

// Logical grouping of navigation. Labels are resolved at render time via i18n.
const navigationGroups: NavGroup[] = [
  {
    i18nKey: 'general',
    fallback: 'General',
    items: [
      { i18nKey: 'dashboard', fallback: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      { i18nKey: 'profile', fallback: 'Profile', href: '/admin/profile', icon: User },
    ],
  },
  {
    i18nKey: 'content',
    fallback: 'Content',
    items: [
      { i18nKey: 'contentCountries', fallback: 'Content / Countries', href: '/admin/content/countries', icon: FileText },
      { i18nKey: 'quizzes', fallback: 'Quizzes', href: '/admin/quizzes', icon: Award },
      { i18nKey: 'certificates', fallback: 'Certificates', href: '/admin/certificates', icon: Award },
      { i18nKey: 'partnerZone', fallback: 'Partner Zone', href: '/admin/partner-zone', icon: Package },
    ],
  },
  {
    i18nKey: 'management',
    fallback: 'Management',
    items: [
      { i18nKey: 'agencies', fallback: 'Agencies', href: '/admin/agencies', icon: Building },
      { i18nKey: 'users', fallback: 'Users', href: '/admin/users', icon: Users },
      { i18nKey: 'reports', fallback: 'Reports', href: '/admin/reports', icon: BarChart3 },
    ],
  },
  {
    i18nKey: 'engagement',
    fallback: 'Engagement',
    items: [
      { i18nKey: 'announcements', fallback: 'Announcements', href: '/admin/announcements', icon: Megaphone },
      { i18nKey: 'popups', fallback: 'Pop-up Ads', href: '/admin/popups', icon: Megaphone, adminOnly: true },
      { i18nKey: 'findyAi', fallback: 'Findy AI', href: '/admin/findy-ai', icon: Bot },
    ],
  },
  {
    i18nKey: 'system',
    fallback: 'System',
    items: [
      { i18nKey: 'settingsPayments', fallback: 'Settings / Payments', href: '/admin/settings/payments', icon: Settings, adminOnly: true },
      { i18nKey: 'integrations', fallback: 'Integrations', href: '/admin/integrations', icon: Plug, adminOnly: true },
      { i18nKey: 'menuManagement', fallback: 'Menu Management', href: '/admin/menu-management', icon: ListTree, adminOnly: true },
    ],
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('admin-sidebar-collapsed') === 'true';
  });
  const [location] = useLocation();
  const { user, role, logout } = useAuthStore();

  const tNavGroup = (key: string, fallback: string) =>
    t(`nav.groups.${key}`, { defaultValue: fallback });
  const tNavItem = (key: string, fallback: string) =>
    t(`nav.items.${key}`, { defaultValue: fallback });

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
    const label = tNavItem(item.i18nKey, item.fallback);
    const content = (
      <div
        className={`
          flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover-elevate
          ${sidebarCollapsed ? 'lg:justify-center' : ''}
          ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground'}
        `}
      >
        <item.icon className={`h-5 w-5 ${sidebarCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'}`} />
        <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{label}</span>
      </div>
    );

    return (
      <div key={item.i18nKey}>
        {sidebarCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={item.href} className="hidden lg:block">{content}</Link>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
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
              <div key={group.i18nKey} className={idx === 0 ? '' : 'mt-3'}>
                {/* Group label (hidden when collapsed) */}
                <div className={`px-3 mb-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {tNavGroup(group.i18nKey, group.fallback)}
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
                {t('common.logout')}
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
                <TooltipContent side="right">{t('common.logout')}</TooltipContent>
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
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
