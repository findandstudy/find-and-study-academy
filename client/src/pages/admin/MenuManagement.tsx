import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  BookOpen,
  Award,
  User,
  Building,
  ShoppingCart,
  Bell,
  Trophy,
  Save,
  RefreshCw,
  Package,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';

type MenuItem = {
  id: string;
  nameKey: string;
  description?: string;
  descriptionKey?: string;
  icon: LucideIcon;
};

type MenuGroup = {
  labelKey: string;
  items: MenuItem[];
};

const agentMenuGroups: MenuGroup[] = [
  {
    labelKey: 'admin.menuMgmt.groupGeneral',
    items: [
      { id: 'dashboard', nameKey: 'admin.menuMgmt.dashboard', icon: LayoutDashboard },
      { id: 'announcements', nameKey: 'admin.menuMgmt.announcements', icon: Bell },
    ],
  },
  {
    labelKey: 'admin.menuMgmt.groupEducation',
    items: [
      { id: 'courses', nameKey: 'admin.menuMgmt.courses', icon: BookOpen },
      { id: 'certificates', nameKey: 'admin.menuMgmt.certificates', icon: Award },
      { id: 'leaderboard', nameKey: 'admin.menuMgmt.leaderboard', icon: Trophy },
    ],
  },
  {
    labelKey: 'admin.menuMgmt.groupAgency',
    items: [
      { id: 'agency', nameKey: 'admin.menuMgmt.myAgency', icon: Building },
      { id: 'profile', nameKey: 'admin.menuMgmt.profile', icon: User },
    ],
  },
  {
    labelKey: 'admin.menuMgmt.groupServices',
    items: [
      { id: 'exams-orders', nameKey: 'admin.menuMgmt.examsOrders', icon: ShoppingCart },
      { id: 'subscriptions', nameKey: 'admin.menuMgmt.subscriptions', icon: Bell },
      { id: 'partner-zone', nameKey: 'admin.menuMgmt.partnerZone', icon: Package },
    ],
  },
];

const globalWidgets: MenuItem[] = [
  {
    id: 'findy',
    nameKey: 'admin.menuMgmt.findyAssistant',
    descriptionKey: 'admin.menuMgmt.findyAssistantDesc',
    icon: MessageCircle,
  },
];

const allTogglableIds: string[] = [
  ...agentMenuGroups.flatMap((g) => g.items.map((i) => i.id)),
  ...globalWidgets.map((w) => w.id),
];

interface MenuVisibility {
  [key: string]: boolean;
}

export default function MenuManagement() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibility>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMenuSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildVisibility = (data: Record<string, unknown>): MenuVisibility => {
    const visibility: MenuVisibility = {};
    allTogglableIds.forEach((id) => {
      visibility[id] = data[id] !== false;
    });
    return visibility;
  };

  const loadMenuSettings = async () => {
    try {
      const response = await fetch('/api/menu-visibility', {
        headers: {
          'x-user-id': user?.id || '',
          'x-user-role': user?.role || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMenuVisibility(buildVisibility(data || {}));
      } else {
        setMenuVisibility(buildVisibility({}));
      }
    } catch (error) {
      console.error('Error loading menu settings:', error);
      setMenuVisibility(buildVisibility({}));
    } finally {
      setLoading(false);
    }
  };

  const toggleMenuItem = (itemId: string) => {
    setMenuVisibility((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/menu-visibility', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-user-role': user?.role || '',
        },
        body: JSON.stringify(menuVisibility),
      });

      if (response.ok) {
        try {
          localStorage.setItem('agent-menu-visibility', JSON.stringify(menuVisibility));
        } catch {
          // ignore quota / private mode errors
        }
        toast({
          title: t('admin.menuMgmt.settingsSaved'),
          description: t('admin.menuMgmt.settingsSavedDesc'),
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving menu settings:', error);
      toast({
        title: t('admin.menuMgmt.saveFailed'),
        description: t('admin.menuMgmt.saveFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const resetVisibility: MenuVisibility = {};
    allTogglableIds.forEach((id) => {
      resetVisibility[id] = true;
    });
    setMenuVisibility(resetVisibility);
    toast({
      title: t('admin.menuMgmt.reset'),
      description: t('admin.menuMgmt.resetDesc'),
    });
  };

  const totalCount = allTogglableIds.length;
  const visibleCount = allTogglableIds.filter((id) => menuVisibility[id]).length;
  const hiddenCount = totalCount - visibleCount;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {t('admin.menuMgmt.title')}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {t('admin.menuMgmt.subtitle')}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{totalCount}</div>
            <p className="text-sm text-muted-foreground">{t('admin.menuMgmt.totalItems')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{visibleCount}</div>
            <p className="text-sm text-muted-foreground">{t('admin.menuMgmt.visible')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{hiddenCount}</div>
            <p className="text-sm text-muted-foreground">{t('admin.menuMgmt.hidden')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar groups */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.menuMgmt.agentSidebar')}</CardTitle>
          <CardDescription>
            {t('admin.menuMgmt.agentSidebarDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('admin.menuMgmt.loadingSettings')}
            </div>
          ) : (
            <div className="space-y-6">
              {agentMenuGroups.map((group) => (
                <div key={group.labelKey} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(group.labelKey)}
                    </Label>
                    <Badge variant="outline">{group.items.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isVisible = menuVisibility[item.id];
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 p-4 rounded-md border border-border hover-elevate"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`p-2 rounded-md shrink-0 ${
                                isVisible
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <Label
                                htmlFor={`toggle-${item.id}`}
                                className="text-base font-medium cursor-pointer"
                              >
                                {t(item.nameKey)}
                              </Label>
                              <p className="text-sm text-muted-foreground truncate">
                                {isVisible
                                  ? t('admin.menuMgmt.visibleToAgents')
                                  : t('admin.menuMgmt.hiddenFromAgents')}
                              </p>
                            </div>
                          </div>
                          <Switch
                            id={`toggle-${item.id}`}
                            checked={isVisible}
                            onCheckedChange={() => toggleMenuItem(item.id)}
                            data-testid={`toggle-${item.id}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global widgets (Findy) */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.menuMgmt.globalWidgets')}</CardTitle>
          <CardDescription>
            {t('admin.menuMgmt.globalWidgetsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('admin.menuMgmt.loadingSettings')}
            </div>
          ) : (
            globalWidgets.map((item) => {
              const Icon = item.icon;
              const isVisible = menuVisibility[item.id];
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-4 rounded-md border border-border hover-elevate"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-md shrink-0 ${
                        isVisible
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <Label
                        htmlFor={`toggle-${item.id}`}
                        className="text-base font-medium cursor-pointer"
                      >
                        {t(item.nameKey)}
                      </Label>
                      {item.descriptionKey && (
                        <p className="text-sm text-muted-foreground">{t(item.descriptionKey)}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {isVisible
                          ? t('admin.menuMgmt.allPanelsOn')
                          : t('admin.menuMgmt.allPanelsOff')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={`toggle-${item.id}`}
                    checked={isVisible}
                    onCheckedChange={() => toggleMenuItem(item.id)}
                    data-testid={`toggle-${item.id}`}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving || loading} data-testid="button-save-menu">
          <Save className="w-4 h-4 mr-2" />
          {saving ? t('admin.menuMgmt.saving') : t('admin.menuMgmt.saveChanges')}
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={loading}
          data-testid="button-reset-menu"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('admin.menuMgmt.resetToDefault')}
        </Button>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.menuMgmt.infoTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• {t('admin.menuMgmt.info1')}</p>
          <p>• {t('admin.menuMgmt.info2')}</p>
          <p>• {t('admin.menuMgmt.info3')}</p>
          <p>• {t('admin.menuMgmt.info4')}</p>
          <p>• {t('admin.menuMgmt.info5')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
