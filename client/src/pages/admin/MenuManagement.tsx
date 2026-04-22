import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
  Package
} from 'lucide-react';

// Agent menu öğeleri
const agentMenuItems = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'courses', name: 'Courses', icon: BookOpen },
  { id: 'certificates', name: 'Certificates', icon: Award },
  { id: 'leaderboard', name: 'Leaderboard', icon: Trophy },
  { id: 'agency', name: 'My Agency', icon: Building },
  { id: 'partner-zone', name: 'Partner Zone', icon: Package },
  { id: 'exams-orders', name: 'Exams/Orders', icon: ShoppingCart },
  { id: 'subscriptions', name: 'Subscriptions', icon: Bell },
  { id: 'profile', name: 'Profile', icon: User },
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

  // Load current settings
  useEffect(() => {
    loadMenuSettings();
  }, []);

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
        const visibility: MenuVisibility = {};
        
        // Set all items to visible by default
        agentMenuItems.forEach(item => {
          visibility[item.id] = data[item.id] !== false; // true if not explicitly false
        });
        
        setMenuVisibility(visibility);
      } else {
        // Default: all visible
        const defaultVisibility: MenuVisibility = {};
        agentMenuItems.forEach(item => {
          defaultVisibility[item.id] = true;
        });
        setMenuVisibility(defaultVisibility);
      }
    } catch (error) {
      console.error('Error loading menu settings:', error);
      // Default: all visible
      const defaultVisibility: MenuVisibility = {};
      agentMenuItems.forEach(item => {
        defaultVisibility[item.id] = true;
      });
      setMenuVisibility(defaultVisibility);
    } finally {
      setLoading(false);
    }
  };

  const toggleMenuItem = (itemId: string) => {
    setMenuVisibility(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
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
        toast({
          title: 'Settings Saved',
          description: 'Agent menu visibility settings have been updated successfully.',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving menu settings:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to update menu settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const resetVisibility: MenuVisibility = {};
    agentMenuItems.forEach(item => {
      resetVisibility[item.id] = true;
    });
    setMenuVisibility(resetVisibility);
    toast({
      title: 'Reset Complete',
      description: 'All menu items have been enabled.',
    });
  };

  const visibleCount = Object.values(menuVisibility).filter(Boolean).length;
  const totalCount = agentMenuItems.length;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Menu Management
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Control which menu items are visible to agents in their sidebar.
          </p>
        </div>
      </div>

      {/* Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{totalCount}</div>
            <p className="text-sm text-muted-foreground">Total Menu Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{visibleCount}</div>
            <p className="text-sm text-muted-foreground">Visible Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{totalCount - visibleCount}</div>
            <p className="text-sm text-muted-foreground">Hidden Items</p>
          </CardContent>
        </Card>
      </div>

      {/* Menu Items */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Sidebar Menu Items</CardTitle>
          <CardDescription>
            Enable or disable menu items for agent users. Hidden items will not appear in the agent sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading menu settings...
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {agentMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isVisible = menuVisibility[item.id];
                  
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover-elevate"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md ${isVisible ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <Label 
                            htmlFor={`toggle-${item.id}`}
                            className="text-base font-medium cursor-pointer"
                          >
                            {item.name}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {isVisible ? 'Visible to agents' : 'Hidden from agents'}
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

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  data-testid="button-save-menu"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  data-testid="button-reset-menu"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset to Default
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Changes take effect immediately for all agent users after saving.</p>
          <p>• Hidden menu items are still accessible if agents know the direct URL.</p>
          <p>• At least one menu item should remain visible for agent navigation.</p>
          <p>• The "Agent Portal" external link is not controlled by this setting.</p>
        </CardContent>
      </Card>
    </div>
  );
}
