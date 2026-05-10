import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
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
import { IntegrationEventLog } from '@/components/IntegrationEventLog';
import { IntegrationApiKeys } from '@/components/IntegrationApiKeys';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  Plug, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  TestTube,
  Power,
  PowerOff,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  CreditCard,
  Mail,
  Cloud,
  Users,
  BarChart3,
  Workflow,
  Globe,
  Database,
  Zap,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  Check
} from 'lucide-react';

// Types
interface Integration {
  id: string;
  name: string;
  type: 'payment' | 'email' | 'storage' | 'crm' | 'analytics' | 'automation';
  enabled: boolean;
  displayName?: string;
  description?: string;
  
  // Generic API config
  endpointUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  
  // Email config
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail?: string;
  
  // Google Sheets
  sheetId?: string;
  tabName?: string;
  
  // CRM
  crmDomain?: string;
  crmToken?: string;
  
  // Automation
  workflowId?: string;
  
  // Status and metadata
  settings?: string;
  lastTestAt?: string;
  lastTestStatus?: 'success' | 'failed' | 'pending' | 'not_tested';
  lastTestMessage?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

// Form schemas
const integrationFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  type: z.enum(['payment', 'email', 'storage', 'crm', 'analytics', 'automation']),
  enabled: z.boolean().default(false),
  displayName: z.string().optional(),
  description: z.string().optional(),
  
  // Generic API
  endpointUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  webhookSecret: z.string().optional(),
  
  // Email
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  fromEmail: z.string().email('Must be a valid email').optional().or(z.literal('')),
  
  // Google Sheets
  sheetId: z.string().optional(),
  tabName: z.string().optional(),
  
  // CRM
  crmDomain: z.string().optional(),
  crmToken: z.string().optional(),
  
  // Automation
  workflowId: z.string().optional(),
});

type IntegrationFormData = z.infer<typeof integrationFormSchema>;

// Type icons and colors
const getTypeIcon = (type: string) => {
  switch (type) {
    case 'payment': return <CreditCard className="w-4 h-4 text-green-600" />;
    case 'email': return <Mail className="w-4 h-4 text-blue-600" />;
    case 'storage': return <Cloud className="w-4 h-4 text-purple-600" />;
    case 'crm': return <Users className="w-4 h-4 text-orange-600" />;
    case 'analytics': return <BarChart3 className="w-4 h-4 text-pink-600" />;
    case 'automation': return <Workflow className="w-4 h-4 text-indigo-600" />;
    default: return <Plug className="w-4 h-4" />;
  }
};

const getStatusIcon = (status?: string) => {
  switch (status) {
    case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
    case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />;
    case 'not_tested': return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
  }
};

const getTypeBadge = (type: string) => {
  const colors = {
    payment: 'default',
    email: 'secondary', 
    storage: 'outline',
    crm: 'default',
    analytics: 'secondary',
    automation: 'outline'
  } as const;
  
  return (
    <Badge variant={colors[type as keyof typeof colors] || 'secondary'}>
      {type}
    </Badge>
  );
};

export default function AdminIntegrations() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('all');
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<{[key: string]: boolean}>({});
  const [createWizardStep, setCreateWizardStep] = useState(1);
  const { toast } = useToast();

  // Fetch integrations
  const { data: integrationsData, isLoading } = useQuery<{ success: boolean; integrations: Integration[]; count: number }>({
    queryKey: ['/api/admin/integrations'],
    staleTime: 30000,
  });

  const integrations = integrationsData?.integrations || [];

  // Filter integrations
  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         integration.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         integration.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = activeTypeFilter === 'all' || integration.type === activeTypeFilter;
    return matchesSearch && matchesType;
  });

  // Group integrations by type
  const groupedIntegrations = filteredIntegrations.reduce((acc, integration) => {
    if (!acc[integration.type]) {
      acc[integration.type] = [];
    }
    acc[integration.type].push(integration);
    return acc;
  }, {} as Record<string, Integration[]>);

  // Form
  const form = useForm<IntegrationFormData>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: {
      name: '',
      type: 'payment',
      enabled: false,
      displayName: '',
      description: '',
      endpointUrl: '',
      apiKey: '',
      apiSecret: '',
      webhookSecret: '',
      smtpHost: '',
      smtpPort: '',
      smtpUser: '',
      smtpPass: '',
      fromEmail: '',
      sheetId: '',
      tabName: '',
      crmDomain: '',
      crmToken: '',
      workflowId: '',
    },
  });

  // Mutations
  const createIntegrationMutation = useMutation({
    mutationFn: (data: IntegrationFormData) =>
      apiRequest('POST', '/api/admin/integrations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/integrations'] });
      toast({
        title: 'Success',
        description: 'Integration created successfully.',
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create integration.',
        variant: 'destructive',
      });
    },
  });

  const updateIntegrationMutation = useMutation({
    mutationFn: ({ id, ...data }: IntegrationFormData & { id: string }) =>
      apiRequest('PUT', `/api/admin/integrations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/integrations'] });
      toast({
        title: 'Success',
        description: 'Integration updated successfully.',
      });
      setIsEditDialogOpen(false);
      setEditingIntegration(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update integration.',
        variant: 'destructive',
      });
    },
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('DELETE', `/api/admin/integrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/integrations'] });
      toast({
        title: 'Success',
        description: 'Integration deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete integration.',
        variant: 'destructive',
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('POST', `/api/admin/integrations/${id}/test`),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/integrations'] });
      toast({
        title: response.testResult.success ? 'Success' : 'Test Failed',
        description: response.testResult.message,
        variant: response.testResult.success ? 'default' : 'destructive',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to test integration.',
        variant: 'destructive',
      });
    },
  });

  const enableIntegrationMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('POST', `/api/admin/integrations/${id}/enable`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/integrations'] });
      toast({
        title: 'Success',
        description: 'Integration enabled successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to enable integration.',
        variant: 'destructive',
      });
    },
  });

  const disableIntegrationMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('POST', `/api/admin/integrations/${id}/disable`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/integrations'] });
      toast({
        title: 'Success',
        description: 'Integration disabled successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to disable integration.',
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const handleCreateIntegration = (data: IntegrationFormData) => {
    createIntegrationMutation.mutate(data);
  };

  const handleEditIntegration = (data: IntegrationFormData) => {
    if (!editingIntegration) return;
    updateIntegrationMutation.mutate({ id: editingIntegration.id, ...data });
  };

  const openEditDialog = (integration: Integration) => {
    setEditingIntegration(integration);
    form.reset({
      name: integration.name,
      type: integration.type,
      enabled: integration.enabled,
      displayName: integration.displayName || '',
      description: integration.description || '',
      endpointUrl: integration.endpointUrl || '',
      apiKey: '', // Don't pre-fill sensitive data
      apiSecret: '', 
      webhookSecret: '',
      smtpHost: integration.smtpHost || '',
      smtpPort: integration.smtpPort || '',
      smtpUser: integration.smtpUser || '',
      smtpPass: '', // Don't pre-fill sensitive data
      fromEmail: integration.fromEmail || '',
      sheetId: integration.sheetId || '',
      tabName: integration.tabName || '',
      crmDomain: integration.crmDomain || '',
      crmToken: '', // Don't pre-fill sensitive data
      workflowId: integration.workflowId || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteIntegration = (id: string) => {
    deleteIntegrationMutation.mutate(id);
  };

  const handleTestConnection = (id: string) => {
    testConnectionMutation.mutate(id);
  };

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    if (enabled) {
      disableIntegrationMutation.mutate(id);
    } else {
      enableIntegrationMutation.mutate(id);
    }
  };

  const toggleSecretVisibility = (integrationId: string) => {
    setShowSecrets(prev => ({ ...prev, [integrationId]: !prev[integrationId] }));
  };

  // Get unique types for filtering
  const availableTypes = ['all', ...Array.from(new Set(integrations.map(i => i.type)))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-heading">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Manage third-party integrations, webhook events, and API key access.
        </p>
      </div>

      <Tabs defaultValue="integrations">
        <TabsList>
          <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
          <TabsTrigger value="event-log" data-testid="tab-event-log">Event Log</TabsTrigger>
          <TabsTrigger value="api-keys" data-testid="tab-api-keys">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="event-log" className="mt-4">
          <IntegrationEventLog integrations={integrations as any} />
        </TabsContent>

        <TabsContent value="api-keys" className="mt-4">
          <IntegrationApiKeys integrations={integrations as any} />
        </TabsContent>

        <TabsContent value="integrations" className="mt-4 space-y-4">

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search integrations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
              data-testid="input-search-integrations"
            />
          </div>
          
          <Select value={activeTypeFilter} onValueChange={setActiveTypeFilter}>
            <SelectTrigger className="w-48" data-testid="select-type-filter">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {availableTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(v) => {
            setIsCreateDialogOpen(v);
            if (!v) { setCreateWizardStep(1); form.reset(); }
          }}
        >
          <DialogTrigger asChild>
            <Button data-testid="button-create-integration">
              <Plus className="w-4 h-4 mr-2" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {createWizardStep === 1 ? 'Choose Integration Type' : 'Configure Integration'}
              </DialogTitle>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mt-3">
                {[1, 2].map(step => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${step === createWizardStep ? 'bg-primary text-primary-foreground' : step < createWizardStep ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                      {step < createWizardStep ? <Check className="w-3.5 h-3.5" /> : step}
                    </div>
                    <span className="text-xs text-muted-foreground">{step === 1 ? 'Type' : 'Config'}</span>
                    {step < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </DialogHeader>

            {/* STEP 1: Type Selection */}
            {createWizardStep === 1 && (
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">Select the type of service you want to connect.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { value: 'payment', label: 'Payment', Icon: CreditCard, desc: 'Stripe, PayPal, Iyzico' },
                    { value: 'email', label: 'Email', Icon: Mail, desc: 'SendGrid, Mailgun, SMTP' },
                    { value: 'storage', label: 'Storage', Icon: Cloud, desc: 'S3, GCS, Object Store' },
                    { value: 'crm', label: 'CRM', Icon: Users, desc: 'HubSpot, Salesforce' },
                    { value: 'analytics', label: 'Analytics', Icon: BarChart3, desc: 'GA4, Mixpanel, Segment' },
                    { value: 'automation', label: 'Automation', Icon: Zap, desc: 'n8n, Zapier, Make' },
                  ].map(typeOpt => {
                    const currentType = form.watch('type');
                    const isSelected = currentType === typeOpt.value;
                    return (
                      <button
                        key={typeOpt.value}
                        type="button"
                        onClick={() => form.setValue('type', typeOpt.value as IntegrationFormData['type'])}
                        className={`flex flex-col items-center gap-2 p-4 rounded-md border-2 transition-colors text-center ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover-elevate'}`}
                        data-testid={`wizard-type-${typeOpt.value}`}
                      >
                        <typeOpt.Icon className={`w-8 h-8 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-semibold">{typeOpt.label}</span>
                        <span className="text-xs text-muted-foreground">{typeOpt.desc}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (!form.watch('type')) { toast({ title: 'Please select a type', variant: 'destructive' }); return; }
                      setCreateWizardStep(2);
                    }}
                    data-testid="wizard-next-step"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Configuration */}
            {createWizardStep === 2 && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateIntegration)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Integration Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., stripe-payments, sendgrid-email" {...field} data-testid="input-integration-name" />
                        </FormControl>
                        <FormDescription>Unique identifier for this integration</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Integration Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-integration-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="payment">Payment</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="storage">Storage</SelectItem>
                            <SelectItem value="crm">CRM</SelectItem>
                            <SelectItem value="analytics">Analytics</SelectItem>
                            <SelectItem value="automation">Automation</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Primary Stripe Account" {...field} data-testid="input-display-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe what this integration does..." {...field} data-testid="input-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Integration</FormLabel>
                        <FormDescription>
                          Allow this integration to be used by the system
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enabled"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Generic API Configuration */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium text-sm text-muted-foreground">API Configuration</h4>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="endpointUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Endpoint URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://api.example.com" {...field} data-testid="input-endpoint-url" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="apiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Key</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Enter API key..." {...field} data-testid="input-api-key" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="apiSecret"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Secret</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Enter API secret..." {...field} data-testid="input-api-secret" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="webhookSecret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Webhook Secret</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter webhook secret..." {...field} data-testid="input-webhook-secret" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Email Configuration */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Email Configuration</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="smtpHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Host</FormLabel>
                          <FormControl>
                            <Input placeholder="smtp.example.com" {...field} data-testid="input-smtp-host" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="smtpPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Port</FormLabel>
                          <FormControl>
                            <Input placeholder="587" {...field} data-testid="input-smtp-port" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="smtpUser"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Username</FormLabel>
                          <FormControl>
                            <Input placeholder="user@example.com" {...field} data-testid="input-smtp-user" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="smtpPass"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter SMTP password..." {...field} data-testid="input-smtp-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="fromEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Email</FormLabel>
                        <FormControl>
                          <Input placeholder="noreply@example.com" {...field} data-testid="input-from-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Google Sheets Configuration */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Google Sheets Configuration</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sheetId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sheet ID</FormLabel>
                          <FormControl>
                            <Input placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" {...field} data-testid="input-sheet-id" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tabName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tab Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Sheet1" {...field} data-testid="input-tab-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* CRM Configuration */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium text-sm text-muted-foreground">CRM Configuration</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="crmDomain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CRM Domain</FormLabel>
                          <FormControl>
                            <Input placeholder="yourcompany.kommo.com" {...field} data-testid="input-crm-domain" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="crmToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CRM Access Token</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter CRM access token..." {...field} data-testid="input-crm-token" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Automation Configuration */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Automation Configuration</h4>
                  
                  <FormField
                    control={form.control}
                    name="workflowId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workflow ID</FormLabel>
                        <FormControl>
                          <Input placeholder="workflow-12345" {...field} data-testid="input-workflow-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateWizardStep(1)}
                    data-testid="button-wizard-back"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      data-testid="button-cancel-create"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createIntegrationMutation.isPending}
                      data-testid="button-submit-create"
                    >
                      {createIntegrationMutation.isPending ? 'Creating...' : 'Create Integration'}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Plug className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium leading-none">Total Integrations</p>
                <p className="text-2xl font-bold">{integrations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div className="ml-2">
                <p className="text-sm font-medium leading-none">Enabled</p>
                <p className="text-2xl font-bold">{integrations.filter(i => i.enabled).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TestTube className="h-4 w-4 text-blue-600" />
              <div className="ml-2">
                <p className="text-sm font-medium leading-none">Tested</p>
                <p className="text-2xl font-bold">{integrations.filter(i => i.lastTestStatus && i.lastTestStatus !== 'not_tested').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Globe className="h-4 w-4 text-purple-600" />
              <div className="ml-2">
                <p className="text-sm font-medium leading-none">Types</p>
                <p className="text-2xl font-bold">{new Set(integrations.map(i => i.type)).size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integrations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5" />
            Integrations ({filteredIntegrations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : filteredIntegrations.length === 0 ? (
            <div className="text-center py-8">
              <Plug className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Integrations Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || activeTypeFilter !== 'all' 
                  ? 'No integrations match your search criteria.' 
                  : 'Get started by adding your first integration.'}
              </p>
              {!searchTerm && activeTypeFilter === 'all' && (
                <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-integration">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Integration
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Test</TableHead>
                    <TableHead>Configuration</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIntegrations.map((integration) => (
                    <TableRow key={integration.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(integration.type)}
                          <div>
                            <div className="font-medium" data-testid={`text-integration-name-${integration.id}`}>
                              {integration.displayName || integration.name}
                            </div>
                            {integration.description && (
                              <div className="text-sm text-muted-foreground">
                                {integration.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getTypeBadge(integration.type)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {integration.enabled ? (
                            <Power className="w-4 h-4 text-green-600" />
                          ) : (
                            <PowerOff className="w-4 h-4 text-gray-500" />
                          )}
                          <span className={integration.enabled ? 'text-green-600' : 'text-muted-foreground'}>
                            {integration.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(integration.lastTestStatus)}
                          <div>
                            <div className="text-sm">
                              {integration.lastTestStatus === 'success' ? 'Passed' : 
                               integration.lastTestStatus === 'failed' ? 'Failed' :
                               integration.lastTestStatus === 'pending' ? 'Testing' : 'Not Tested'}
                            </div>
                            {integration.lastTestAt && (
                              <div className="text-xs text-muted-foreground">
                                {new Date(integration.lastTestAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {integration.apiKey && '• API Key'}
                          {integration.endpointUrl && '• Endpoint'}
                          {integration.smtpHost && '• SMTP'}
                          {integration.crmDomain && '• CRM'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(integration.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(integration.id)}
                            disabled={testConnectionMutation.isPending}
                            data-testid={`button-test-${integration.id}`}
                          >
                            <TestTube className="w-3 h-3" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleEnabled(integration.id, integration.enabled)}
                            data-testid={`button-toggle-${integration.id}`}
                          >
                            {integration.enabled ? (
                              <PowerOff className="w-3 h-3" />
                            ) : (
                              <Power className="w-3 h-3" />
                            )}
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(integration)}
                            data-testid={`button-edit-${integration.id}`}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" data-testid={`button-delete-${integration.id}`}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Integration</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{integration.displayName || integration.name}"? This action cannot be undone and may affect system functionality.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteIntegration(integration.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  data-testid={`button-confirm-delete-${integration.id}`}
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

      {/* Edit Integration Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Integration</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditIntegration)} className="space-y-4">
              {/* Simplified edit form - similar to create but with note about sensitive data */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> For security reasons, sensitive fields (API keys, passwords, tokens) are not pre-filled. 
                  Leave them empty to keep existing values, or enter new values to update them.
                </p>
              </div>

              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Integration Name</FormLabel>
                      <FormControl>
                        <Input {...field} disabled data-testid="input-edit-name" />
                      </FormControl>
                      <FormDescription>Name cannot be changed</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Integration Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="payment">Payment</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="storage">Storage</SelectItem>
                          <SelectItem value="crm">CRM</SelectItem>
                          <SelectItem value="analytics">Analytics</SelectItem>
                          <SelectItem value="automation">Automation</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-display-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-edit-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Integration</FormLabel>
                      <FormDescription>
                        Allow this integration to be used by the system
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-enabled"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Sensitive configuration note */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium text-sm text-muted-foreground">Update Configuration</h4>
                <p className="text-sm text-muted-foreground">
                  Enter new values for any fields you want to update. Empty fields will keep their existing values.
                </p>
                
                {/* Basic API fields */}
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="endpointUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endpoint URL</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-endpoint-url" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Leave empty to keep existing" {...field} data-testid="input-edit-api-key" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateIntegrationMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {updateIntegrationMutation.isPending ? 'Updating...' : 'Update Integration'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

        </TabsContent>
      </Tabs>
    </div>
  );
}