import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  CreditCard,
  Save,
  Key,
  Globe,
  Shield,
  Bell,
  Palette,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  DollarSign
} from 'lucide-react';

// Types
interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: 'general' | 'security' | 'notification' | 'appearance';
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  isPublic: boolean;
  updatedAt: string;
  updatedBy?: string;
}

interface PaymentConfig {
  id: string;
  provider: 'none' | 'stripe' | 'paypal' | 'razorpay';
  enabled: boolean;
  displayName?: string;
  publicKey?: string;
  secretKey?: string; // Masked in API responses
  webhookSecret?: string; // Masked in API responses
  successUrl?: string;
  cancelUrl?: string;
  settings?: string; // JSON string
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

// Form schemas
const systemSettingFormSchema = z.object({
  key: z.string().min(1, 'Key is required').max(100, 'Key must be less than 100 characters'),
  value: z.string().min(1, 'Value is required'),
  category: z.enum(['general', 'security', 'notification', 'appearance']).default('general'),
  type: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
});

const paymentConfigFormSchema = z.object({
  provider: z.enum(['none', 'stripe', 'paypal', 'razorpay']).default('none'),
  enabled: z.boolean().default(false),
  displayName: z.string().optional(),
  publicKey: z.string().optional(),
  secretKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  successUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  cancelUrl: z.string().url('Must be a valid URL').optional().or(z.literal(''))
});

type SystemSettingFormData = z.infer<typeof systemSettingFormSchema>;
type PaymentConfigFormData = z.infer<typeof paymentConfigFormSchema>;

// Category icons
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'general': return <Globe className="w-4 h-4 text-blue-500" />;
    case 'security': return <Shield className="w-4 h-4 text-red-500" />;
    case 'notification': return <Bell className="w-4 h-4 text-yellow-500" />;
    case 'appearance': return <Palette className="w-4 h-4 text-purple-500" />;
    default: return <Settings className="w-4 h-4" />;
  }
};

// Provider badges
const getProviderBadge = (provider: string, isActive: boolean) => {
  const colors = {
    none: 'secondary',
    stripe: 'default',
    paypal: 'default',
    razorpay: 'default'
  } as const;
  
  return (
    <div className="flex items-center gap-2">
      <Badge variant={colors[provider as keyof typeof colors] || 'secondary'}>
        {provider}
      </Badge>
      {isActive && <Badge variant="outline" className="text-green-600">Active</Badge>}
    </div>
  );
};

// --- Defaults Tab Component ---
function DefaultsTabContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: countriesData } = useQuery<{ success: boolean; countries: any[] }>({
    queryKey: ['/api/admin/countries'],
  });
  const { data: defaultsData, isLoading: defaultsLoading } = useQuery<{ success: boolean; defaults: Record<string, string> }>({
    queryKey: ['/api/settings/defaults'],
  });

  const countries = countriesData?.countries?.filter((c: any) => c.status === 'active') ?? [];
  const defaults = defaultsData?.defaults ?? {};

  const [defaultCountry, setDefaultCountry] = useState('');
  const [platformName, setPlatformName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');

  useEffect(() => {
    if (defaults.default_country_code) setDefaultCountry(defaults.default_country_code);
    if (defaults.platform_name) setPlatformName(defaults.platform_name);
    if (defaults.support_email) setSupportEmail(defaults.support_email);
  }, [defaults]);

  const saveDefaultMutation = useMutation({
    mutationFn: async (payload: { key: string; value: string }) =>
      apiRequest('POST', '/api/admin/settings', { key: payload.key, value: payload.value, category: 'general', type: 'string', isPublic: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/defaults'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({ title: 'Saved', description: 'Default settings updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save setting.', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    if (defaultCountry) saveDefaultMutation.mutate({ key: 'default_country_code', value: defaultCountry });
    if (platformName) saveDefaultMutation.mutate({ key: 'platform_name', value: platformName });
    if (supportEmail) saveDefaultMutation.mutate({ key: 'support_email', value: supportEmail });
  };

  if (defaultsLoading) return <div className="py-8 text-center text-muted-foreground">Loading defaults...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Defaults</CardTitle>
        <CardDescription>Configure default settings applied platform-wide.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Default Country</Label>
          <Select value={defaultCountry} onValueChange={setDefaultCountry}>
            <SelectTrigger data-testid="select-default-country">
              <SelectValue placeholder="Select default country..." />
            </SelectTrigger>
            <SelectContent>
              {countries.map((c: any) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.flag ? <span className="mr-2">{c.flag}</span> : null}{c.name} ({c.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">New agents will see this country's courses by default.</p>
        </div>
        <div className="space-y-2">
          <Label>Platform Name</Label>
          <Input
            value={platformName}
            onChange={(e) => setPlatformName(e.target.value)}
            placeholder="Find And Study Academy"
            data-testid="input-platform-name"
          />
        </div>
        <div className="space-y-2">
          <Label>Support Email</Label>
          <Input
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="support@example.com"
            data-testid="input-support-email"
          />
        </div>
        <Button onClick={handleSave} disabled={saveDefaultMutation.isPending} data-testid="button-save-defaults">
          {saveDefaultMutation.isPending ? 'Saving...' : 'Save Defaults'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminSettingsPayments() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('settings');
  const [editingSetting, setEditingSetting] = useState<SystemSetting | null>(null);
  const [editingPaymentConfig, setEditingPaymentConfig] = useState<PaymentConfig | null>(null);
  const [isCreateSettingDialogOpen, setIsCreateSettingDialogOpen] = useState(false);
  const [isEditSettingDialogOpen, setIsEditSettingDialogOpen] = useState(false);
  const [isCreatePaymentDialogOpen, setIsCreatePaymentDialogOpen] = useState(false);
  const [isEditPaymentDialogOpen, setIsEditPaymentDialogOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<{[key: string]: boolean}>({});
  const { toast } = useToast();

  // Fetch system settings
  const { data: settingsData, isLoading: settingsLoading } = useQuery<{ success: boolean; settings: SystemSetting[] }>({
    queryKey: ['/api/admin/settings'],
    staleTime: 30000,
  });

  // Fetch payment configurations
  const { data: paymentConfigsData, isLoading: paymentsLoading } = useQuery<{ success: boolean; configs: PaymentConfig[] }>({
    queryKey: ['/api/admin/payment-configs'],
    staleTime: 30000,
  });

  const settings = settingsData?.settings || [];
  const paymentConfigs = paymentConfigsData?.configs || [];

  // Filter settings based on search
  const filteredSettings = settings.filter(setting =>
    setting.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    setting.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (setting.description && setting.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Forms
  const settingForm = useForm<SystemSettingFormData>({
    resolver: zodResolver(systemSettingFormSchema),
    defaultValues: {
      key: '',
      value: '',
      category: 'general',
      type: 'string',
      description: '',
      isPublic: false,
    },
  });

  const paymentForm = useForm<PaymentConfigFormData>({
    resolver: zodResolver(paymentConfigFormSchema),
    defaultValues: {
      provider: 'none',
      enabled: false,
      displayName: '',
      publicKey: '',
      secretKey: '',
      webhookSecret: '',
      successUrl: '',
      cancelUrl: '',
    },
  });

  // System Settings Mutations
  const createSettingMutation = useMutation({
    mutationFn: (data: SystemSettingFormData) =>
      apiRequest('POST', '/api/admin/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({
        title: 'Success',
        description: 'Setting created successfully.',
      });
      setIsCreateSettingDialogOpen(false);
      settingForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create setting.',
        variant: 'destructive',
      });
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, ...data }: SystemSettingFormData & { key: string }) =>
      apiRequest('PUT', `/api/admin/settings/${key}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({
        title: 'Success',
        description: 'Setting updated successfully.',
      });
      setIsEditSettingDialogOpen(false);
      setEditingSetting(null);
      settingForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update setting.',
        variant: 'destructive',
      });
    },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: (key: string) =>
      apiRequest('DELETE', `/api/admin/settings/${key}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({
        title: 'Success',
        description: 'Setting deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete setting.',
        variant: 'destructive',
      });
    },
  });

  // Payment Configuration Mutations
  const createPaymentConfigMutation = useMutation({
    mutationFn: (data: PaymentConfigFormData) =>
      apiRequest('POST', '/api/admin/payment-configs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payment-configs'] });
      toast({
        title: 'Success',
        description: 'Payment configuration created successfully.',
      });
      setIsCreatePaymentDialogOpen(false);
      paymentForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create payment configuration.',
        variant: 'destructive',
      });
    },
  });

  const updatePaymentConfigMutation = useMutation({
    mutationFn: ({ id, ...data }: PaymentConfigFormData & { id: string }) =>
      apiRequest('PUT', `/api/admin/payment-configs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payment-configs'] });
      toast({
        title: 'Success',
        description: 'Payment configuration updated successfully.',
      });
      setIsEditPaymentDialogOpen(false);
      setEditingPaymentConfig(null);
      paymentForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update payment configuration.',
        variant: 'destructive',
      });
    },
  });

  const activatePaymentConfigMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('POST', `/api/admin/payment-configs/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payment-configs'] });
      toast({
        title: 'Success',
        description: 'Payment configuration activated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to activate payment configuration.',
        variant: 'destructive',
      });
    },
  });

  const deletePaymentConfigMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('DELETE', `/api/admin/payment-configs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payment-configs'] });
      toast({
        title: 'Success',
        description: 'Payment configuration deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete payment configuration.',
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const handleCreateSetting = (data: SystemSettingFormData) => {
    createSettingMutation.mutate(data);
  };

  const handleEditSetting = (data: SystemSettingFormData) => {
    if (!editingSetting) return;
    updateSettingMutation.mutate({ ...data, key: editingSetting.key });
  };

  const openEditSettingDialog = (setting: SystemSetting) => {
    setEditingSetting(setting);
    settingForm.reset({
      key: setting.key,
      value: setting.value,
      category: setting.category,
      type: setting.type,
      description: setting.description || '',
      isPublic: setting.isPublic,
    });
    setIsEditSettingDialogOpen(true);
  };

  const handleCreatePaymentConfig = (data: PaymentConfigFormData) => {
    createPaymentConfigMutation.mutate(data);
  };

  const handleEditPaymentConfig = (data: PaymentConfigFormData) => {
    if (!editingPaymentConfig) return;
    updatePaymentConfigMutation.mutate({ id: editingPaymentConfig.id, ...data });
  };

  const openEditPaymentDialog = (config: PaymentConfig) => {
    setEditingPaymentConfig(config);
    paymentForm.reset({
      provider: config.provider,
      enabled: config.enabled,
      displayName: config.displayName || '',
      publicKey: config.publicKey || '',
      secretKey: '', // Don't pre-fill sensitive data
      webhookSecret: '', // Don't pre-fill sensitive data
      successUrl: config.successUrl || '',
      cancelUrl: config.cancelUrl || '',
    });
    setIsEditPaymentDialogOpen(true);
  };

  const handleDeleteSetting = (key: string) => {
    deleteSettingMutation.mutate(key);
  };

  const handleDeletePaymentConfig = (id: string) => {
    deletePaymentConfigMutation.mutate(id);
  };

  const handleActivatePaymentConfig = (id: string) => {
    activatePaymentConfigMutation.mutate(id);
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-heading">Settings & Payments</h1>
        <p className="text-muted-foreground mt-1">
          Manage system configuration and payment provider settings.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-2" />
            System Settings
          </TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">
            <CreditCard className="w-4 h-4 mr-2" />
            Payment Configuration
          </TabsTrigger>
          <TabsTrigger value="defaults" data-testid="tab-defaults">
            <Globe className="w-4 h-4 mr-2" />
            Defaults
          </TabsTrigger>
        </TabsList>

        {/* System Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search settings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
                data-testid="input-search-settings"
              />
            </div>
            
            <Dialog open={isCreateSettingDialogOpen} onOpenChange={setIsCreateSettingDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-setting">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Setting
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create System Setting</DialogTitle>
                </DialogHeader>
                <Form {...settingForm}>
                  <form onSubmit={settingForm.handleSubmit(handleCreateSetting)} className="space-y-4">
                    <FormField
                      control={settingForm.control}
                      name="key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., site_name, max_upload_size" {...field} data-testid="input-setting-key" />
                          </FormControl>
                          <FormDescription>Unique identifier for this setting</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingForm.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Value</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Setting value..." {...field} data-testid="input-setting-value" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={settingForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-setting-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="security">Security</SelectItem>
                                <SelectItem value="notification">Notification</SelectItem>
                                <SelectItem value="appearance">Appearance</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={settingForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-setting-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="string">String</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                                <SelectItem value="json">JSON</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={settingForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Describe this setting..." {...field} data-testid="input-setting-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingForm.control}
                      name="isPublic"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Public Setting</FormLabel>
                            <FormDescription>
                              Make this setting accessible to frontend applications
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-setting-public"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateSettingDialogOpen(false)}
                        data-testid="button-cancel-create-setting"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createSettingMutation.isPending}
                        data-testid="button-submit-create-setting"
                      >
                        {createSettingMutation.isPending ? 'Creating...' : 'Create'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Settings Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                System Settings ({filteredSettings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : filteredSettings.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Settings Found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? 'No settings match your search criteria.' : 'Get started by creating your first system setting.'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setIsCreateSettingDialogOpen(true)} data-testid="button-create-first-setting">
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Setting
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Public</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSettings.map((setting) => (
                        <TableRow key={setting.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(setting.category)}
                              <span data-testid={`text-setting-key-${setting.id}`}>{setting.key}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate" data-testid={`text-setting-value-${setting.id}`}>
                              {setting.value}
                            </div>
                            {setting.description && (
                              <div className="text-sm text-muted-foreground">
                                {setting.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{setting.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{setting.type}</Badge>
                          </TableCell>
                          <TableCell>
                            {setting.isPublic ? (
                              <Eye className="w-4 h-4 text-green-600" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(setting.updatedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditSettingDialog(setting)}
                                data-testid={`button-edit-setting-${setting.id}`}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" data-testid={`button-delete-setting-${setting.id}`}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Setting</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the setting "{setting.key}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteSetting(setting.key)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      data-testid={`button-confirm-delete-setting-${setting.id}`}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Configuration Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isCreatePaymentDialogOpen} onOpenChange={setIsCreatePaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-payment-config">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Payment Provider
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Payment Provider</DialogTitle>
                </DialogHeader>
                <Form {...paymentForm}>
                  <form onSubmit={paymentForm.handleSubmit(handleCreatePaymentConfig)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={paymentForm.control}
                        name="provider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Provider</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-payment-provider">
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">None (Disable Payments)</SelectItem>
                                <SelectItem value="stripe">Stripe</SelectItem>
                                <SelectItem value="paypal">PayPal</SelectItem>
                                <SelectItem value="razorpay">Razorpay</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={paymentForm.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Display Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Primary Stripe Account" {...field} data-testid="input-payment-display-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={paymentForm.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Payment Processing</FormLabel>
                            <FormDescription>
                              Allow this provider to process payments
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-payment-enabled"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        control={paymentForm.control}
                        name="publicKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Public/Publishable Key</FormLabel>
                            <FormControl>
                              <Input placeholder="pk_test_..." {...field} data-testid="input-payment-public-key" />
                            </FormControl>
                            <FormDescription>Your public API key (safe to expose to frontend)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={paymentForm.control}
                        name="secretKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secret/Private Key</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="sk_test_..." 
                                {...field} 
                                data-testid="input-payment-secret-key" 
                              />
                            </FormControl>
                            <FormDescription>Your secret API key (keep this secure)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={paymentForm.control}
                        name="webhookSecret"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Webhook Secret</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="whsec_..." 
                                {...field} 
                                data-testid="input-payment-webhook-secret" 
                              />
                            </FormControl>
                            <FormDescription>Webhook endpoint signing secret for security</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={paymentForm.control}
                        name="successUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Success URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://yoursite.com/success" {...field} data-testid="input-payment-success-url" />
                            </FormControl>
                            <FormDescription>Where to redirect after successful payment</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={paymentForm.control}
                        name="cancelUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cancel URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://yoursite.com/cancel" {...field} data-testid="input-payment-cancel-url" />
                            </FormControl>
                            <FormDescription>Where to redirect after payment cancellation</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreatePaymentDialogOpen(false)}
                        data-testid="button-cancel-create-payment"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createPaymentConfigMutation.isPending}
                        data-testid="button-submit-create-payment"
                      >
                        {createPaymentConfigMutation.isPending ? 'Creating...' : 'Create'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Payment Configurations Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Providers ({paymentConfigs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : paymentConfigs.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Payment Providers</h3>
                  <p className="text-muted-foreground mb-4">
                    Configure your first payment provider to enable transactions.
                  </p>
                  <Button onClick={() => setIsCreatePaymentDialogOpen(true)} data-testid="button-create-first-payment">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Payment Provider
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Public Key</TableHead>
                        <TableHead>Secret Key</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentConfigs.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell>
                            {getProviderBadge(config.provider, config.isActive)}
                          </TableCell>
                          <TableCell>
                            <span data-testid={`text-payment-display-name-${config.id}`}>
                              {config.displayName || 'Unnamed Configuration'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {config.enabled ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-red-600" />
                              )}
                              <span className={config.enabled ? 'text-green-600' : 'text-red-600'}>
                                {config.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate text-sm font-mono">
                              {config.publicKey || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono">
                                {config.secretKey || '-'}
                              </span>
                              {config.secretKey && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleSecretVisibility(config.id)}
                                  data-testid={`button-toggle-secret-${config.id}`}
                                >
                                  {showSecrets[config.id] ? (
                                    <EyeOff className="w-3 h-3" />
                                  ) : (
                                    <Eye className="w-3 h-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(config.updatedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {!config.isActive && config.enabled && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleActivatePaymentConfig(config.id)}
                                  data-testid={`button-activate-payment-${config.id}`}
                                  disabled={activatePaymentConfigMutation.isPending}
                                >
                                  <CheckCircle className="w-3 h-3" />
                                </Button>
                              )}
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditPaymentDialog(config)}
                                data-testid={`button-edit-payment-${config.id}`}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" data-testid={`button-delete-payment-${config.id}`}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Payment Configuration</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this payment provider configuration? This action cannot be undone and may affect payment processing.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeletePaymentConfig(config.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      data-testid={`button-confirm-delete-payment-${config.id}`}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Defaults Tab */}
        <TabsContent value="defaults" className="space-y-4">
          <DefaultsTabContent />
        </TabsContent>
      </Tabs>

      {/* Edit Setting Dialog */}
      <Dialog open={isEditSettingDialogOpen} onOpenChange={setIsEditSettingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit System Setting</DialogTitle>
          </DialogHeader>
          <Form {...settingForm}>
            <form onSubmit={settingForm.handleSubmit(handleEditSetting)} className="space-y-4">
              <FormField
                control={settingForm.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key</FormLabel>
                    <FormControl>
                      <Input {...field} disabled data-testid="input-edit-setting-key" />
                    </FormControl>
                    <FormDescription>Setting key cannot be changed</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={settingForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Setting value..." {...field} data-testid="input-edit-setting-value" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={settingForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-setting-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="security">Security</SelectItem>
                          <SelectItem value="notification">Notification</SelectItem>
                          <SelectItem value="appearance">Appearance</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={settingForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-setting-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                          <SelectItem value="json">JSON</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={settingForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Describe this setting..." {...field} data-testid="input-edit-setting-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={settingForm.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Public Setting</FormLabel>
                      <FormDescription>
                        Make this setting accessible to frontend applications
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-setting-public"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditSettingDialogOpen(false)}
                  data-testid="button-cancel-edit-setting"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateSettingMutation.isPending}
                  data-testid="button-submit-edit-setting"
                >
                  {updateSettingMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Configuration Dialog */}
      <Dialog open={isEditPaymentDialogOpen} onOpenChange={setIsEditPaymentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Payment Configuration</DialogTitle>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handleEditPaymentConfig)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={paymentForm.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Provider</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-payment-provider">
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None (Disable Payments)</SelectItem>
                          <SelectItem value="stripe">Stripe</SelectItem>
                          <SelectItem value="paypal">PayPal</SelectItem>
                          <SelectItem value="razorpay">Razorpay</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={paymentForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Primary Stripe Account" {...field} data-testid="input-edit-payment-display-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={paymentForm.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Payment Processing</FormLabel>
                      <FormDescription>
                        Allow this provider to process payments
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-payment-enabled"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={paymentForm.control}
                  name="publicKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public/Publishable Key</FormLabel>
                      <FormControl>
                        <Input placeholder="pk_test_..." {...field} data-testid="input-edit-payment-public-key" />
                      </FormControl>
                      <FormDescription>Your public API key (safe to expose to frontend)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={paymentForm.control}
                  name="secretKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secret/Private Key</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Leave empty to keep existing key" 
                          {...field} 
                          data-testid="input-edit-payment-secret-key" 
                        />
                      </FormControl>
                      <FormDescription>Enter new secret key or leave empty to keep current</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={paymentForm.control}
                  name="webhookSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook Secret</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Leave empty to keep existing secret" 
                          {...field} 
                          data-testid="input-edit-payment-webhook-secret" 
                        />
                      </FormControl>
                      <FormDescription>Enter new webhook secret or leave empty to keep current</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={paymentForm.control}
                  name="successUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Success URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://yoursite.com/success" {...field} data-testid="input-edit-payment-success-url" />
                      </FormControl>
                      <FormDescription>Where to redirect after successful payment</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={paymentForm.control}
                  name="cancelUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cancel URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://yoursite.com/cancel" {...field} data-testid="input-edit-payment-cancel-url" />
                      </FormControl>
                      <FormDescription>Where to redirect after payment cancellation</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditPaymentDialogOpen(false)}
                  data-testid="button-cancel-edit-payment"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updatePaymentConfigMutation.isPending}
                  data-testid="button-submit-edit-payment"
                >
                  {updatePaymentConfigMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}