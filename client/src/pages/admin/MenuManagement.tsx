import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
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
  name: string;
  description?: string;
  icon: LucideIcon;
};

type MenuGroup = {
  label: string;
  description?: string;
  items: MenuItem[];
};

const agentMenuGroups: MenuGroup[] = [
  {
    label: 'Genel',
    items: [
      { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
      { id: 'announcements', name: 'Duyurular', icon: Bell },
    ],
  },
  {
    label: 'Eğitim',
    items: [
      { id: 'courses', name: 'Kurslar', icon: BookOpen },
      { id: 'certificates', name: 'Sertifikalar', icon: Award },
      { id: 'leaderboard', name: 'Liderlik Tablosu', icon: Trophy },
    ],
  },
  {
    label: 'Acente',
    items: [
      { id: 'agency', name: 'Acentem', icon: Building },
      { id: 'profile', name: 'Profil', icon: User },
    ],
  },
  {
    label: 'Hizmetler',
    items: [
      { id: 'exams-orders', name: 'Sınavlar / Siparişler', icon: ShoppingCart },
      { id: 'subscriptions', name: 'Abonelikler', icon: Bell },
      { id: 'partner-zone', name: 'İş Ortağı Bölgesi', icon: Package },
    ],
  },
];

const globalWidgets: MenuItem[] = [
  {
    id: 'findy',
    name: 'Findy Asistan',
    description:
      'Tüm panellerin sağ alt köşesinde görünen sohbet widget\'ı. Kapatıldığında hem admin hem de agent panellerinde gizlenir.',
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
          title: 'Ayarlar Kaydedildi',
          description: 'Menü görünürlük ayarları başarıyla güncellendi.',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving menu settings:', error);
      toast({
        title: 'Kaydedilemedi',
        description: 'Menü ayarları güncellenemedi. Lütfen tekrar deneyin.',
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
      title: 'Sıfırlandı',
      description: 'Tüm menü öğeleri etkinleştirildi.',
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
            Menü Yönetimi
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Acente kenar çubuğunda hangi öğelerin görüneceğini ve Findy asistanının açık olup olmayacağını kontrol edin.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{totalCount}</div>
            <p className="text-sm text-muted-foreground">Toplam Öğe</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{visibleCount}</div>
            <p className="text-sm text-muted-foreground">Görünür</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{hiddenCount}</div>
            <p className="text-sm text-muted-foreground">Gizli</p>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar groups */}
      <Card>
        <CardHeader>
          <CardTitle>Acente Kenar Çubuğu</CardTitle>
          <CardDescription>
            Acentenin kenar çubuğunda hangi öğelerin görüneceğini açıp kapatın. Gizlenen öğeler menüde gözükmez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Ayarlar yükleniyor...</div>
          ) : (
            <div className="space-y-6">
              {agentMenuGroups.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
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
                                {item.name}
                              </Label>
                              <p className="text-sm text-muted-foreground truncate">
                                {isVisible ? 'Acentelere görünür' : 'Acentelerden gizli'}
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
          <CardTitle>Genel Widget'lar</CardTitle>
          <CardDescription>
            Tüm panellerde (admin ve agent) görünen widget'ları yönetin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Ayarlar yükleniyor...</div>
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
                        {item.name}
                      </Label>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {isVisible ? 'Tüm panellerde açık' : 'Tüm panellerde kapalı'}
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
          {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={loading}
          data-testid="button-reset-menu"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Varsayılana Dön
        </Button>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Bilgilendirme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Değişiklikler kaydedildikten sonra tüm kullanıcılar için anında geçerli olur.</p>
          <p>• Gizlenen menü öğelerine, doğrudan URL üzerinden hâlâ erişilebilir; tam erişim engelleme için rol/izin kullanın.</p>
          <p>• Acentelerin gezinebilmesi için en az bir menü öğesinin açık kalması önerilir.</p>
          <p>• "Agent Portal" ve "Dorm Booking" dış bağlantıları bu ayarlardan etkilenmez.</p>
          <p>• Findy Asistan kapatıldığında, hem admin hem de agent panellerinde sohbet düğmesi gizlenir.</p>
        </CardContent>
      </Card>
    </div>
  );
}
