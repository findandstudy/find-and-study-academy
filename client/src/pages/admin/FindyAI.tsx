import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Bot, MessageSquare, Settings, BarChart2, Users, Zap,
  Eye, EyeOff, RefreshCw, Save, AlertCircle, CheckCircle,
  TrendingUp, Clock, ThumbsUp, ThumbsDown, ChevronRight,
  BookOpen, Code2, Webhook, Upload, FileText, Trash2, Plus,
  Copy, Globe, Shield, Key, Link, ExternalLink
} from 'lucide-react';
import dayjs from 'dayjs';

interface FindyConfig {
  [key: string]: string | null;
}

interface FindyConversation {
  id: string;
  sessionId: string;
  channel: string;
  userId: string | null;
  messageCount: number;
  tokenCount: number;
  fallbackCount: number;
  feedbackPositive: number;
  feedbackNegative: number;
  startedAt: string;
  lastMessageAt: string;
}

interface FindyMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  tokenCount: number;
  isFallback: boolean;
  feedback: string | null;
  latencyMs: number | null;
  createdAt: string;
}

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'google_gemini', label: 'Google Gemini' },
  { value: 'mistral', label: 'Mistral AI' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom', label: 'Custom Endpoint' },
  { value: 'n8n', label: 'n8n Webhook (current)' },
];

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
const ANTHROPIC_MODELS = ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'];
const GEMINI_MODELS = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'];
const MISTRAL_MODELS = ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'];

function getModelsForProvider(provider: string) {
  switch (provider) {
    case 'openai': return OPENAI_MODELS;
    case 'anthropic': return ANTHROPIC_MODELS;
    case 'google_gemini': return GEMINI_MODELS;
    case 'mistral': return MISTRAL_MODELS;
    default: return [];
  }
}

export default function AdminFindyAI() {
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: configData, isLoading: configLoading } = useQuery<{ success: boolean; config: FindyConfig }>({
    queryKey: ['/api/admin/findy/config'],
  });
  const { data: analyticsData } = useQuery<{ success: boolean; analytics: any }>({
    queryKey: ['/api/admin/findy/analytics'],
  });
  const { data: conversationsData, isLoading: convsLoading } = useQuery<{ success: boolean; conversations: FindyConversation[] }>({
    queryKey: ['/api/admin/findy/conversations'],
  });

  const config = configData?.config ?? {};
  const analytics = analyticsData?.analytics ?? {};
  const conversations = conversationsData?.conversations ?? [];

  const bulkSaveMutation = useMutation({
    mutationFn: async (configs: { key: string; value: string }[]) =>
      apiRequest('POST', '/api/admin/findy/config/bulk', { configs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/findy/config'] });
      toast({ title: 'Saved', description: 'Findy AI settings updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-7 h-7 text-primary" />
          Findy AI
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your AI assistant — provider, persona, knowledge base, conversations and analytics.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="overview" data-testid="tab-findy-overview">
            <BarChart2 className="w-4 h-4 mr-1" /> Overview
          </TabsTrigger>
          <TabsTrigger value="provider" data-testid="tab-findy-provider">
            <Zap className="w-4 h-4 mr-1" /> Provider & Model
          </TabsTrigger>
          <TabsTrigger value="persona" data-testid="tab-findy-persona">
            <Bot className="w-4 h-4 mr-1" /> Persona & Prompt
          </TabsTrigger>
          <TabsTrigger value="conversations" data-testid="tab-findy-conversations">
            <MessageSquare className="w-4 h-4 mr-1" /> Conversations
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-findy-analytics">
            <TrendingUp className="w-4 h-4 mr-1" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-findy-settings">
            <Settings className="w-4 h-4 mr-1" /> Settings
          </TabsTrigger>
          <TabsTrigger value="knowledge-base" data-testid="tab-findy-knowledge">
            <BookOpen className="w-4 h-4 mr-1" /> Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="channels" data-testid="tab-findy-channels">
            <Code2 className="w-4 h-4 mr-1" /> Channels & Embed
          </TabsTrigger>
          <TabsTrigger value="api-webhooks" data-testid="tab-findy-api">
            <Webhook className="w-4 h-4 mr-1" /> API & Webhooks
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Conversations</p>
                    <p className="text-2xl font-bold" data-testid="text-total-conversations">{analytics.totalConversations ?? 0}</p>
                  </div>
                  <MessageSquare className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Messages</p>
                    <p className="text-2xl font-bold">{analytics.totalMessages ?? 0}</p>
                  </div>
                  <Bot className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tokens</p>
                    <p className="text-2xl font-bold">{(analytics.totalTokens ?? 0).toLocaleString()}</p>
                  </div>
                  <Zap className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Fallback Rate</p>
                    <p className="text-2xl font-bold">
                      {analytics.fallbackRate != null ? `${(analytics.fallbackRate * 100).toFixed(1)}%` : '0%'}
                    </p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Current Configuration</CardTitle>
              <CardDescription>Active provider and persona settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {configLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Provider</span>
                    <Badge variant="outline">{config.ai_provider || 'n8n (default)'}</Badge>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Model</span>
                    <span>{config.ai_model || '—'}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Persona Name</span>
                    <span>{config.persona_name || 'Findy'}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Strict Mode</span>
                    <Badge variant={config.strict_mode === 'true' ? 'default' : 'secondary'}>
                      {config.strict_mode === 'true' ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">API Key Status</span>
                    <Badge variant={config.ai_api_key_configured === 'true' ? 'default' : 'secondary'}>
                      {config.ai_api_key_configured === 'true' ? 'Configured' : 'Not configured'}
                    </Badge>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Widget Enabled</span>
                    <Badge variant={config.widget_enabled !== 'false' ? 'default' : 'secondary'}>
                      {config.widget_enabled !== 'false' ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROVIDER & MODEL */}
        <TabsContent value="provider" className="space-y-4">
          <ProviderTab config={config} onSave={(configs) => bulkSaveMutation.mutate(configs)} saving={bulkSaveMutation.isPending} />
        </TabsContent>

        {/* PERSONA & PROMPT */}
        <TabsContent value="persona" className="space-y-4">
          <PersonaTab config={config} onSave={(configs) => bulkSaveMutation.mutate(configs)} saving={bulkSaveMutation.isPending} />
        </TabsContent>

        {/* CONVERSATIONS */}
        <TabsContent value="conversations" className="space-y-4">
          <ConversationsTab conversations={conversations} isLoading={convsLoading} />
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsTab analytics={analytics} conversations={conversations} />
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings" className="space-y-4">
          <FindySettingsTab config={config} onSave={(configs) => bulkSaveMutation.mutate(configs)} saving={bulkSaveMutation.isPending} />
        </TabsContent>

        {/* KNOWLEDGE BASE */}
        <TabsContent value="knowledge-base" className="space-y-4">
          <KnowledgeBaseTab config={config} onSave={(configs) => bulkSaveMutation.mutate(configs)} saving={bulkSaveMutation.isPending} />
        </TabsContent>

        {/* CHANNELS & EMBED */}
        <TabsContent value="channels" className="space-y-4">
          <ChannelsEmbedTab config={config} onSave={(configs) => bulkSaveMutation.mutate(configs)} saving={bulkSaveMutation.isPending} />
        </TabsContent>

        {/* API & WEBHOOKS */}
        <TabsContent value="api-webhooks" className="space-y-4">
          <ApiWebhooksTab config={config} onSave={(configs) => bulkSaveMutation.mutate(configs)} saving={bulkSaveMutation.isPending} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Provider Tab ----
function ProviderTab({ config, onSave, saving }: { config: FindyConfig; onSave: (c: any[]) => void; saving: boolean }) {
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setProvider(config.ai_provider || 'n8n');
    setModel(config.ai_model || '');
    setBaseUrl(config.ai_base_url || '');
    setTemperature(parseFloat(config.ai_temperature || '0.7'));
    setMaxTokens(parseInt(config.ai_max_tokens || '1000'));
  }, [config]);

  const models = getModelsForProvider(provider);
  const isApiKey = apiKey.length > 0;

  const handleSave = () => {
    const configs = [
      { key: 'ai_provider', value: provider },
      { key: 'ai_model', value: model },
      { key: 'ai_base_url', value: baseUrl },
      { key: 'ai_temperature', value: String(temperature) },
      { key: 'ai_max_tokens', value: String(maxTokens) },
    ];
    if (isApiKey) {
      configs.push({ key: 'ai_api_key_configured', value: 'true' });
    }
    onSave(configs);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>Select the AI provider and model. API keys are stored securely and never displayed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => { setProvider(v); setModel(''); }}>
                <SelectTrigger data-testid="select-ai-provider">
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              {models.length > 0 ? (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger data-testid="select-ai-model">
                    <SelectValue placeholder="Select model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. gpt-4o" data-testid="input-ai-model" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={config.ai_api_key_configured === 'true' ? '••••••••••••••• (configured)' : 'Enter API key...'}
                data-testid="input-ai-api-key"
              />
              <Button size="icon" variant="ghost" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {config.ai_api_key_configured === 'true'
                ? 'API key is configured. Enter a new key to rotate it.'
                : 'API key is not configured. Enter key and save.'}
            </p>
          </div>

          {(provider === 'azure_openai' || provider === 'custom' || provider === 'openrouter') && (
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" data-testid="input-ai-base-url" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Temperature: {temperature.toFixed(2)}</Label>
            </div>
            <Slider
              min={0} max={2} step={0.05}
              value={[temperature]}
              onValueChange={([v]) => setTemperature(v)}
              data-testid="slider-temperature"
            />
            <p className="text-xs text-muted-foreground">Higher = more creative. Lower = more deterministic.</p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Max Output Tokens: {maxTokens}</Label>
            </div>
            <Slider
              min={100} max={4000} step={100}
              value={[maxTokens]}
              onValueChange={([v]) => setMaxTokens(v)}
              data-testid="slider-max-tokens"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} data-testid="button-save-provider">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Provider Settings'}
        </Button>
      </div>
    </div>
  );
}

// ---- Persona Tab ----
function PersonaTab({ config, onSave, saving }: { config: FindyConfig; onSave: (c: any[]) => void; saving: boolean }) {
  const [personaName, setPersonaName] = useState('Findy');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [inputPlaceholder, setInputPlaceholder] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [refusalMessage, setRefusalMessage] = useState('');
  const [strictMode, setStrictMode] = useState(false);
  const [maxMessageLength, setMaxMessageLength] = useState(2000);
  const [bannedTopics, setBannedTopics] = useState('');

  useEffect(() => {
    setPersonaName(config.persona_name || 'Findy');
    setWelcomeMessage(config.welcome_message || 'Hello! I\'m Findy, your Find And Study AI assistant. How can I help you today?');
    setInputPlaceholder(config.input_placeholder || 'Ask me anything about your courses...');
    setSystemPrompt(config.system_prompt || '');
    setFallbackMessage(config.fallback_message || 'I don\'t have information about this in the Find And Study system.');
    setRefusalMessage(config.refusal_message || 'I can only answer questions related to Find And Study Academy.');
    setStrictMode(config.strict_mode === 'true');
    setMaxMessageLength(parseInt(config.max_message_length || '2000'));
    setBannedTopics(config.banned_topics || '');
  }, [config]);

  const handleSave = () => {
    onSave([
      { key: 'persona_name', value: personaName },
      { key: 'welcome_message', value: welcomeMessage },
      { key: 'input_placeholder', value: inputPlaceholder },
      { key: 'system_prompt', value: systemPrompt },
      { key: 'fallback_message', value: fallbackMessage },
      { key: 'refusal_message', value: refusalMessage },
      { key: 'strict_mode', value: String(strictMode) },
      { key: 'max_message_length', value: String(maxMessageLength) },
      { key: 'banned_topics', value: bannedTopics },
    ]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Persona</CardTitle>
          <CardDescription>Define how Findy presents itself to users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Persona Name</Label>
              <Input value={personaName} onChange={e => setPersonaName(e.target.value)} placeholder="Findy" data-testid="input-persona-name" />
            </div>
            <div className="space-y-2">
              <Label>Max User Message Length</Label>
              <Input type="number" value={maxMessageLength} onChange={e => setMaxMessageLength(parseInt(e.target.value) || 2000)} data-testid="input-max-message-length" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Welcome Message</Label>
            <Textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} rows={2} data-testid="input-welcome-message" />
          </div>
          <div className="space-y-2">
            <Label>Input Placeholder</Label>
            <Input value={inputPlaceholder} onChange={e => setInputPlaceholder(e.target.value)} data-testid="input-placeholder-text" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Prompt</CardTitle>
          <CardDescription>
            The system instruction sent to the AI with every request. Supports variables:{' '}
            <code className="text-xs bg-muted px-1 rounded">{'{{user.name}}'}</code>{' '}
            <code className="text-xs bg-muted px-1 rounded">{'{{today}}'}</code>{' '}
            <code className="text-xs bg-muted px-1 rounded">{'{{country_default}}'}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            rows={8}
            placeholder="You are Findy, an AI assistant for Find And Study Academy..."
            data-testid="textarea-system-prompt"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guardrails</CardTitle>
          <CardDescription>Control what Findy can and cannot discuss.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Strict Mode</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, Findy can ONLY answer from knowledge base sources. If no relevant source is found, it returns the fallback message — never uses general AI knowledge.
              </p>
            </div>
            <Switch
              checked={strictMode}
              onCheckedChange={setStrictMode}
              data-testid="switch-strict-mode"
            />
          </div>
          {strictMode && (
            <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200 flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Strict mode is active. Ensure your knowledge base has enough content to answer common questions.</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>Fallback Message (shown when no KB match)</Label>
            <Textarea value={fallbackMessage} onChange={e => setFallbackMessage(e.target.value)} rows={2} data-testid="input-fallback-message" />
          </div>
          <div className="space-y-2">
            <Label>Refusal Message (for banned topics)</Label>
            <Textarea value={refusalMessage} onChange={e => setRefusalMessage(e.target.value)} rows={2} data-testid="input-refusal-message" />
          </div>
          <div className="space-y-2">
            <Label>Banned Topics (comma-separated)</Label>
            <Input value={bannedTopics} onChange={e => setBannedTopics(e.target.value)} placeholder="politics, competitor names, ..." data-testid="input-banned-topics" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} data-testid="button-save-persona">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Persona Settings'}
        </Button>
      </div>
    </div>
  );
}

// ---- Conversations Tab ----
function ConversationsTab({ conversations, isLoading }: { conversations: FindyConversation[]; isLoading: boolean }) {
  const [selected, setSelected] = useState<FindyConversation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: convDetail } = useQuery<{ success: boolean; conversation: FindyConversation; messages: FindyMessage[] }>({
    queryKey: ['/api/admin/findy/conversations', selected?.id],
    enabled: !!selected?.id,
  });

  const openConversation = (conv: FindyConversation) => {
    setSelected(conv);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Conversation Log</CardTitle>
          <CardDescription>All Findy AI conversations sorted by most recent.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No conversations yet. Users need to chat with Findy first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started At</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Fallbacks</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversations.map(conv => (
                    <TableRow key={conv.id} data-testid={`row-conversation-${conv.id}`}>
                      <TableCell className="text-sm">{dayjs(conv.startedAt).format('MMM D, HH:mm')}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{conv.channel}</Badge>
                      </TableCell>
                      <TableCell>{conv.messageCount}</TableCell>
                      <TableCell>{conv.tokenCount}</TableCell>
                      <TableCell>
                        {conv.fallbackCount > 0 ? (
                          <Badge variant="destructive">{conv.fallbackCount}</Badge>
                        ) : '0'}
                      </TableCell>
                      <TableCell className="flex items-center gap-1">
                        {conv.feedbackPositive > 0 && (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <ThumbsUp className="w-3 h-3" />{conv.feedbackPositive}
                          </span>
                        )}
                        {conv.feedbackNegative > 0 && (
                          <span className="flex items-center gap-1 text-red-600 text-sm">
                            <ThumbsDown className="w-3 h-3" />{conv.feedbackNegative}
                          </span>
                        )}
                        {conv.feedbackPositive === 0 && conv.feedbackNegative === 0 && '—'}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => openConversation(conv)}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conversation Transcript</DialogTitle>
          </DialogHeader>
          {convDetail ? (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Session: {convDetail.conversation.sessionId.slice(0, 8)}...</span>
                <span>Channel: {convDetail.conversation.channel}</span>
                <span>Started: {dayjs(convDetail.conversation.startedAt).format('MMM D, HH:mm')}</span>
              </div>
              <div className="space-y-2">
                {convDetail.messages.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No messages recorded.</p>
                ) : (
                  convDetail.messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-md text-sm ${msg.role === 'user'
                        ? 'bg-muted ml-8'
                        : 'bg-primary/10 mr-8'}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium capitalize">{msg.role}</span>
                        {msg.isFallback && <Badge variant="destructive" className="text-xs">Fallback</Badge>}
                        {msg.latencyMs && <span className="text-xs text-muted-foreground">{msg.latencyMs}ms</span>}
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Analytics Tab ----
function AnalyticsTab({ analytics, conversations }: { analytics: any; conversations: FindyConversation[] }) {
  const channelCounts = conversations.reduce((acc: Record<string, number>, c) => {
    acc[c.channel] = (acc[c.channel] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Conversations</p>
            <p className="text-3xl font-bold">{analytics.totalConversations ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Messages</p>
            <p className="text-3xl font-bold">{analytics.totalMessages ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Avg Messages/Conv</p>
            <p className="text-3xl font-bold">
              {analytics.totalConversations > 0
                ? (analytics.totalMessages / analytics.totalConversations).toFixed(1)
                : '0'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Channel Distribution</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(channelCounts).length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(channelCounts).map(([ch, cnt]) => (
                <div key={ch} className="flex items-center gap-3">
                  <span className="w-20 text-sm capitalize">{ch}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${(cnt / conversations.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8 text-right">{cnt}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Settings Tab ----
function FindySettingsTab({ config, onSave, saving }: { config: FindyConfig; onSave: (c: any[]) => void; saving: boolean }) {
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [widgetPosition, setWidgetPosition] = useState('bottom-right');
  const [widgetPrimaryColor, setWidgetPrimaryColor] = useState('#143591');
  const [logRetentionDays, setLogRetentionDays] = useState(90);
  const [rateLimitPerIp, setRateLimitPerIp] = useState(60);

  useEffect(() => {
    setWidgetEnabled(config.widget_enabled !== 'false');
    setWidgetPosition(config.widget_position || 'bottom-right');
    setWidgetPrimaryColor(config.widget_primary_color || '#143591');
    setLogRetentionDays(parseInt(config.log_retention_days || '90'));
    setRateLimitPerIp(parseInt(config.rate_limit_per_ip || '60'));
  }, [config]);

  const handleSave = () => {
    onSave([
      { key: 'widget_enabled', value: String(widgetEnabled) },
      { key: 'widget_position', value: widgetPosition },
      { key: 'widget_primary_color', value: widgetPrimaryColor },
      { key: 'log_retention_days', value: String(logRetentionDays) },
      { key: 'rate_limit_per_ip', value: String(rateLimitPerIp) },
    ]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Widget Settings</CardTitle>
          <CardDescription>Control the appearance and behavior of the Findy chat widget.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base">Widget Enabled</Label>
            <Switch checked={widgetEnabled} onCheckedChange={setWidgetEnabled} data-testid="switch-widget-enabled" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={widgetPosition} onValueChange={setWidgetPosition}>
                <SelectTrigger data-testid="select-widget-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={widgetPrimaryColor}
                  onChange={e => setWidgetPrimaryColor(e.target.value)}
                  className="w-12 p-1 h-auto"
                  data-testid="input-widget-color"
                />
                <Input value={widgetPrimaryColor} onChange={e => setWidgetPrimaryColor(e.target.value)} placeholder="#143591" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate Limits & Retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rate Limit (requests/min per IP)</Label>
              <Input
                type="number"
                value={rateLimitPerIp}
                onChange={e => setRateLimitPerIp(parseInt(e.target.value) || 60)}
                data-testid="input-rate-limit"
              />
            </div>
            <div className="space-y-2">
              <Label>Log Retention (days)</Label>
              <Input
                type="number"
                value={logRetentionDays}
                onChange={e => setLogRetentionDays(parseInt(e.target.value) || 90)}
                data-testid="input-log-retention"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment Variables Status</CardTitle>
          <CardDescription>Check if required environment variables are configured.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { key: 'N8N_WEBHOOK_URL', label: 'n8n Webhook URL' },
              { key: 'OPENAI_API_KEY', label: 'OpenAI API Key' },
              { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key' },
              { key: 'DATABASE_URL', label: 'Database URL' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <span className="font-mono text-xs">{key}</span>
                <span className="text-muted-foreground">{label}</span>
                <Badge variant="secondary" className="text-xs">
                  Set via Replit Secrets
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            To configure these values, use the Replit Secrets panel (lock icon in the sidebar) and restart the server.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} data-testid="button-save-findy-settings">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

// ─── Knowledge Base Tab ───────────────────────────────────────────────────────
function KnowledgeBaseTab({ config, onSave, saving }: { config: FindyConfig; onSave: (c: any[]) => void; saving: boolean }) {
  const { toast } = useToast();
  const [ragEnabled, setRagEnabled] = useState(config['findy_rag_enabled'] === 'true');
  const [vectorDb, setVectorDb] = useState(config['findy_vector_db'] || 'none');
  const [ragUrl, setRagUrl] = useState(config['findy_rag_url'] || '');
  const [ragApiKey, setRagApiKey] = useState(config['findy_rag_api_key'] || '');
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    onSave([
      { key: 'findy_rag_enabled', value: ragEnabled ? 'true' : 'false', label: 'RAG Enabled', isSecret: false },
      { key: 'findy_vector_db', value: vectorDb, label: 'Vector DB Provider', isSecret: false },
      { key: 'findy_rag_url', value: ragUrl, label: 'RAG Endpoint URL', isSecret: false },
      { key: 'findy_rag_api_key', value: ragApiKey, label: 'RAG API Key', isSecret: true },
    ]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-5 h-5 text-primary" />
            Knowledge Base (RAG) Configuration
          </CardTitle>
          <CardDescription>
            Connect a vector database to enable Retrieval-Augmented Generation. Findy will search your knowledge base before generating responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
            <div>
              <p className="text-sm font-medium">Enable RAG</p>
              <p className="text-xs text-muted-foreground">Search knowledge base before responding</p>
            </div>
            <Switch checked={ragEnabled} onCheckedChange={setRagEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Vector Database Provider</Label>
            <Select value={vectorDb} onValueChange={setVectorDb} disabled={!ragEnabled}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (RAG Disabled)</SelectItem>
                <SelectItem value="pinecone">Pinecone</SelectItem>
                <SelectItem value="qdrant">Qdrant</SelectItem>
                <SelectItem value="weaviate">Weaviate</SelectItem>
                <SelectItem value="chroma">ChromaDB</SelectItem>
                <SelectItem value="custom">Custom HTTP Endpoint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {vectorDb !== 'none' && ragEnabled && (
            <>
              <div className="space-y-2">
                <Label>RAG Endpoint URL</Label>
                <Input
                  value={ragUrl}
                  onChange={e => setRagUrl(e.target.value)}
                  placeholder="https://your-vector-db-endpoint.com/query"
                />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={ragApiKey}
                    onChange={e => setRagApiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowKey(s => !s)}>
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5 text-primary" />
            Document Sources
          </CardTitle>
          <CardDescription>
            Documents indexed in your knowledge base. Upload files via your vector database provider's dashboard or API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/20 p-6 text-center space-y-3">
            <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Connect a vector database to manage documents</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Once connected, documents will be automatically indexed and Findy will use them to answer questions with accurate, source-grounded responses.
            </p>
            {vectorDb !== 'none' && ragEnabled && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                {vectorDb} configured
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Knowledge Base Settings'}
        </Button>
      </div>
    </div>
  );
}

// ─── Channels & Embed Tab ─────────────────────────────────────────────────────
function ChannelsEmbedTab({ config, onSave, saving }: { config: FindyConfig; onSave: (c: any[]) => void; saving: boolean }) {
  const { toast } = useToast();
  const [primaryColor, setPrimaryColor] = useState(config['findy_widget_color'] || '#143591');
  const [position, setPosition] = useState(config['findy_widget_position'] || 'bottom-right');
  const [greeting, setGreeting] = useState(config['findy_widget_greeting'] || 'Merhaba! Size nasıl yardımcı olabilirim?');
  const [allowedDomains, setAllowedDomains] = useState(config['findy_allowed_domains'] || '');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.replit.app';

  const embedCode = `<!-- Findy AI Chat Widget -->
<script>
  window.FindyConfig = {
    origin: '${origin}',
    primaryColor: '${primaryColor}',
    position: '${position}',
    greeting: '${greeting.replace(/'/g, "\\'")}',
  };
</script>
<script src="${origin}/findy-widget.js" async defer></script>`;

  const iframeCode = `<iframe
  src="${origin}/embed/chat"
  width="400"
  height="600"
  frameborder="0"
  allow="microphone"
  style="border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12);"
></iframe>`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} kopyalandı` });
    });
  };

  const handleSave = () => {
    onSave([
      { key: 'findy_widget_color', value: primaryColor, label: 'Widget Primary Color', isSecret: false },
      { key: 'findy_widget_position', value: position, label: 'Widget Position', isSecret: false },
      { key: 'findy_widget_greeting', value: greeting, label: 'Widget Greeting Message', isSecret: false },
      { key: 'findy_allowed_domains', value: allowedDomains, label: 'Allowed Embed Domains', isSecret: false },
    ]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-5 h-5 text-primary" />
            Widget Configuration
          </CardTitle>
          <CardDescription>Customize the Findy chat widget that appears on your pages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-md border cursor-pointer"
                />
                <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Widget Position</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="top-left">Top Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Greeting Message</Label>
            <Textarea
              value={greeting}
              onChange={e => setGreeting(e.target.value)}
              rows={2}
              placeholder="Merhaba! Size nasıl yardımcı olabilirim?"
            />
          </div>
          <div className="space-y-2">
            <Label>Allowed Domains (comma-separated)</Label>
            <Input
              value={allowedDomains}
              onChange={e => setAllowedDomains(e.target.value)}
              placeholder="findandstudy.com, partner.findandstudy.com"
            />
            <p className="text-xs text-muted-foreground">Leave empty to allow all domains.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Code2 className="w-5 h-5 text-primary" />
            Embed Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Script Embed (Floating Widget)</Label>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(embedCode, 'Script kodu')}>
                <Copy className="w-4 h-4 mr-1" /> Kopyala
              </Button>
            </div>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap">{embedCode}</pre>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>iFrame Embed (Inline)</Label>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(iframeCode, 'iFrame kodu')}>
                <Copy className="w-4 h-4 mr-1" /> Kopyala
              </Button>
            </div>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap">{iframeCode}</pre>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Channel Settings'}
        </Button>
      </div>
    </div>
  );
}

// ─── API & Webhooks Tab ───────────────────────────────────────────────────────
function ApiWebhooksTab({ config, onSave, saving }: { config: FindyConfig; onSave: (c: any[]) => void; saving: boolean }) {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState(config['findy_webhook_url'] || '');
  const [webhookSecret, setWebhookSecret] = useState(config['findy_webhook_secret'] || '');
  const [notifyOnNew, setNotifyOnNew] = useState(config['findy_notify_new_conv'] !== 'false');
  const [notifyOnFallback, setNotifyOnFallback] = useState(config['findy_notify_fallback'] !== 'false');
  const [showSecret, setShowSecret] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.replit.app';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} kopyalandı` });
    });
  };

  const handleSave = () => {
    onSave([
      { key: 'findy_webhook_url', value: webhookUrl, label: 'Findy Webhook URL', isSecret: false },
      { key: 'findy_webhook_secret', value: webhookSecret, label: 'Findy Webhook Secret', isSecret: true },
      { key: 'findy_notify_new_conv', value: notifyOnNew ? 'true' : 'false', label: 'Notify on New Conversation', isSecret: false },
      { key: 'findy_notify_fallback', value: notifyOnFallback ? 'true' : 'false', label: 'Notify on Fallback', isSecret: false },
    ]);
  };

  const apiEndpoints = [
    { method: 'POST', path: '/api/chat', description: 'Send a message to Findy AI' },
    { method: 'GET', path: '/api/findy/conversations', description: 'List chat conversations' },
    { method: 'GET', path: '/api/findy/conversations/:id/messages', description: 'Get messages for a conversation' },
    { method: 'GET', path: '/api/public/contents/:id/translation', description: 'Fetch translated content' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="w-5 h-5 text-primary" />
            Outgoing Webhooks
          </CardTitle>
          <CardDescription>
            Findy will POST events to your endpoint with HMAC-SHA256 signature (X-Findy-Signature header).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://your-service.com/webhooks/findy"
            />
          </div>
          <div className="space-y-2">
            <Label>Webhook Secret</Label>
            <div className="flex gap-2">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={webhookSecret}
                onChange={e => setWebhookSecret(e.target.value)}
                placeholder="your-secret-key"
              />
              <Button variant="outline" size="icon" onClick={() => setShowSecret(s => !s)}>
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">Trigger Events</p>
            <div className="space-y-2">
              {[
                { key: 'notifyOnNew', label: 'New Conversation Started', value: notifyOnNew, onChange: setNotifyOnNew },
                { key: 'notifyOnFallback', label: 'Fallback / Low Confidence Response', value: notifyOnFallback, onChange: setNotifyOnFallback },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <span className="text-sm">{item.label}</span>
                  <Switch checked={item.value} onCheckedChange={item.onChange} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-5 h-5 text-primary" />
            REST API Reference
          </CardTitle>
          <CardDescription>
            Base URL: <code className="text-xs bg-muted px-1 rounded">{origin}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {apiEndpoints.map(ep => (
              <div key={ep.path} className="flex items-start gap-3 p-3 rounded-md border bg-muted/20">
                <Badge variant={ep.method === 'GET' ? 'secondary' : 'default'} className="shrink-0 font-mono">
                  {ep.method}
                </Badge>
                <div className="min-w-0">
                  <code className="text-xs font-mono break-all">{ep.path}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">{ep.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(origin + ep.path, 'URL')}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Authentication: Include <code className="bg-muted px-1 rounded">x-user-id</code> header with the user's ID for authenticated endpoints.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save API & Webhook Settings'}
        </Button>
      </div>
    </div>
  );
}
