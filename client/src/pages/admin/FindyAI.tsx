import { useState, useEffect, useRef } from 'react';
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
import { useAuthStore } from '@/store/auth';
import {
  Bot, MessageSquare, Settings, BarChart2, Users, Zap,
  Eye, EyeOff, RefreshCw, Save, AlertCircle, CheckCircle,
  TrendingUp, Clock, ThumbsUp, ThumbsDown, ChevronRight,
  BookOpen, Code2, Webhook, Upload, FileText, Trash2, Plus,
  Copy, Globe, Shield, Key, Link, ExternalLink,
  Download, Database, FileSpreadsheet, FileQuestion, RotateCcw, X,
  Search
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

// Comprehensive model catalogue per provider. Lists are intentionally broad and
// include both the latest flagship releases and older still-supported models so
// admins can pick whichever the customer's API key has access to. A "custom"
// sentinel is appended to every list so a free-text input is always reachable
// for brand-new model names that haven't shipped here yet.
const CUSTOM_MODEL_OPTION = '__custom__';

const OPENAI_MODELS = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4o-2024-11-20',
  'gpt-4o-2024-08-06',
  'gpt-4o-2024-05-13',
  'chatgpt-4o-latest',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-4',
  'gpt-4-32k',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k',
  'o4-mini',
  'o3',
  'o3-mini',
  'o3-pro',
  'o1',
  'o1-mini',
  'o1-pro',
  'o1-preview',
];

const ANTHROPIC_MODELS = [
  'claude-opus-4-5',
  'claude-sonnet-4-5',
  'claude-opus-4',
  'claude-sonnet-4',
  'claude-3-7-sonnet-latest',
  'claude-3-5-sonnet-latest',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620',
  'claude-3-5-haiku-latest',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
];

const GEMINI_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-thinking-exp',
  'gemini-1.5-pro',
  'gemini-1.5-pro-002',
  'gemini-1.5-flash',
  'gemini-1.5-flash-002',
  'gemini-1.5-flash-8b',
  'gemini-1.0-pro',
];

const MISTRAL_MODELS = [
  'mistral-large-latest',
  'mistral-large-2411',
  'mistral-medium-latest',
  'mistral-small-latest',
  'mistral-small-2503',
  'ministral-8b-latest',
  'ministral-3b-latest',
  'codestral-latest',
  'codestral-mamba-latest',
  'pixtral-large-latest',
  'pixtral-12b',
  'open-mistral-7b',
  'open-mixtral-8x7b',
  'open-mixtral-8x22b',
  'open-mistral-nemo',
];

const OPENROUTER_MODELS = [
  // OpenAI on OpenRouter
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-4.1',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/o3',
  'openai/o3-mini',
  'openai/o1',
  // Anthropic on OpenRouter
  'anthropic/claude-opus-4-5',
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-3.7-sonnet',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3.5-haiku',
  // Google on OpenRouter
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'google/gemini-2.0-flash',
  // Meta Llama
  'meta-llama/llama-3.3-70b-instruct',
  'meta-llama/llama-3.1-405b-instruct',
  'meta-llama/llama-3.1-70b-instruct',
  'meta-llama/llama-3.1-8b-instruct',
  // DeepSeek
  'deepseek/deepseek-r1',
  'deepseek/deepseek-v3',
  'deepseek/deepseek-chat',
  // xAI Grok
  'x-ai/grok-4',
  'x-ai/grok-3',
  'x-ai/grok-2-1212',
  // Mistral on OpenRouter
  'mistralai/mistral-large',
  'mistralai/mixtral-8x22b-instruct',
  // Qwen
  'qwen/qwen-2.5-72b-instruct',
  'qwen/qwq-32b-preview',
];

function getModelsForProvider(provider: string): string[] {
  switch (provider) {
    case 'openai': return OPENAI_MODELS;
    case 'anthropic': return ANTHROPIC_MODELS;
    case 'google_gemini': return GEMINI_MODELS;
    case 'mistral': return MISTRAL_MODELS;
    case 'openrouter': return OPENROUTER_MODELS;
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
          <TabsTrigger value="sources" data-testid="tab-findy-sources">
            <BookOpen className="w-4 h-4 mr-1" /> Sources
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

        {/* SOURCES */}
        <TabsContent value="sources" className="space-y-4">
          <SourcesTab />
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
  // Tracks whether the user has explicitly opted into the free-text custom-model
  // input. Decoupled from `model.length === 0` so picking "Custom…" from the
  // dropdown keeps the input visible even before any character is typed.
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    const nextProvider = config.ai_provider || 'n8n';
    const nextModel = config.ai_model || '';
    setProvider(nextProvider);
    setModel(nextModel);
    setBaseUrl(config.ai_base_url || '');
    setTemperature(parseFloat(config.ai_temperature || '0.7'));
    setMaxTokens(parseInt(config.ai_max_tokens || '1000'));
    // Auto-detect custom mode on load: a saved value that doesn't appear in the
    // curated list for its provider must be a custom / fine-tuned model name.
    const curated = getModelsForProvider(nextProvider);
    setCustomMode(!!nextModel && curated.length > 0 && !curated.includes(nextModel));
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
      // Persist the actual key so it can be used by the chat backend, plus the
      // boolean flag the UI uses to render the "Configured" badge. The GET
      // endpoint redacts `ai_api_key` so the value is never echoed back to the
      // browser; the input is intentionally blank on reload (rotate by typing
      // a new key).
      configs.push({ key: 'ai_api_key', value: apiKey });
      configs.push({ key: 'ai_api_key_configured', value: 'true' });
    }
    onSave(configs);
    if (isApiKey) {
      // Clear the local input after a successful submit attempt so the next
      // load shows "(configured)" rather than re-displaying the new key.
      setApiKey('');
    }
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
              <Select
                value={provider}
                onValueChange={(v) => {
                  setProvider(v);
                  // Clear stale model + custom mode whenever the provider changes,
                  // since each provider has its own model namespace.
                  setModel('');
                  setCustomMode(false);
                }}
              >
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
                <>
                  <Select
                    value={customMode ? CUSTOM_MODEL_OPTION : model}
                    onValueChange={(v) => {
                      if (v === CUSTOM_MODEL_OPTION) {
                        setCustomMode(true);
                        setModel('');
                      } else {
                        setCustomMode(false);
                        setModel(v);
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-ai-model">
                      <SelectValue placeholder="Select model..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      <SelectItem value={CUSTOM_MODEL_OPTION} data-testid="option-model-custom">
                        Custom… (type model name)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {customMode && (
                    <Input
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      placeholder="e.g. my-fine-tuned-model"
                      data-testid="input-ai-model-custom"
                      autoFocus
                    />
                  )}
                </>
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

// ── SOURCES TAB ──────────────────────────────────────────────────────────────
interface KnowledgeSource {
  id: string;
  name: string;
  type: string;
  fileType: string | null;
  originalName: string | null;
  url: string | null;
  status: string;
  rowCount: number | null;
  chunkCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DebugChunk {
  id: string;
  preview: string;
  score: number;
  matchedTerms: string[];
}

interface DebugResult {
  query: string;
  chunks: DebugChunk[];
}

function SourcesTab() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false);
  const [urlForm, setUrlForm] = useState({ url: '', name: '' });
  const [uploadName, setUploadName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [testQuery, setTestQuery] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);

  const handleDebugSearch = async () => {
    if (!testQuery.trim()) return;
    setTestLoading(true);
    setDebugResult(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ message: testQuery }),
      });
      const json = await res.json();
      if (json.debug?.chunks) {
        setDebugResult({ query: testQuery, chunks: json.debug.chunks });
      } else {
        setDebugResult({ query: testQuery, chunks: [] });
        toast({ title: 'No debug data', description: json.success ? 'No chunks were retrieved for this query.' : (json.message || 'Request failed'), variant: json.success ? 'default' : 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setTestLoading(false);
    }
  };

  const { data, isLoading, refetch } = useQuery<{ success: boolean; sources: KnowledgeSource[] }>({
    queryKey: ['/api/admin/findy/sources'],
    refetchInterval: (query) => {
      const sources = query.state.data?.sources || [];
      return sources.some(s => s.status === 'processing') ? 3000 : false;
    },
  });

  const sources = data?.sources || [];

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch('/api/admin/findy/sources/upload', {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '' },
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      toast({ title: 'Uploaded', description: 'Source is being processed...' });
      qc.invalidateQueries({ queryKey: ['/api/admin/findy/sources'] });
      setSelectedFile(null);
      setUploadName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: any) => toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }),
  });

  const urlMutation = useMutation({
    mutationFn: async (data: { url: string; name: string }) =>
      apiRequest('POST', '/api/admin/findy/sources/url', data) as Promise<any>,
    onSuccess: () => {
      toast({ title: 'URL added', description: 'Source is being processed...' });
      qc.invalidateQueries({ queryKey: ['/api/admin/findy/sources'] });
      setIsUrlDialogOpen(false);
      setUrlForm({ url: '', name: '' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest('DELETE', `/api/admin/findy/sources/${id}`) as Promise<any>,
    onSuccess: () => {
      toast({ title: 'Deleted' });
      qc.invalidateQueries({ queryKey: ['/api/admin/findy/sources'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const reprocessMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest('POST', `/api/admin/findy/sources/${id}/reprocess`) as Promise<any>,
    onSuccess: () => {
      toast({ title: 'Reprocessing started' });
      qc.invalidateQueries({ queryKey: ['/api/admin/findy/sources'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelectedFile(f);
    if (!uploadName) setUploadName(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleUploadSubmit = () => {
    if (!selectedFile) return;
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('name', uploadName || selectedFile.name);
    uploadMutation.mutate(fd);
  };

  const getFileIcon = (fileType: string | null) => {
    if (fileType === 'excel') return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
    if (fileType === 'pdf') return <FileText className="w-4 h-4 text-red-500" />;
    if (fileType === 'word') return <FileText className="w-4 h-4 text-blue-500" />;
    if (fileType === 'url') return <Globe className="w-4 h-4 text-primary" />;
    return <FileQuestion className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') return <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
    if (status === 'processing') return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
    return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />Knowledge Sources</CardTitle>
          <CardDescription>
            Upload files or add URLs as knowledge sources. Findy AI will search these sources to answer agent questions accurately with minimal token usage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* How it works */}
          <div className="rounded-md border p-4 bg-muted/30 space-y-2">
            <p className="text-sm font-medium">How it works (Token-efficient RAG)</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Each file is parsed and split into searchable chunks stored in the database</li>
              <li>When an agent asks a question, only the <strong>top 15 most relevant</strong> chunks are sent to the AI</li>
              <li>Excel rows each become individual searchable chunks — ideal for university/program data</li>
              <li>You can update a source by deleting it and re-uploading the new version</li>
            </ul>
          </div>

          {/* Upload area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File upload */}
            <div className="border rounded-md p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><Upload className="w-4 h-4" />Upload File</p>
              <p className="text-xs text-muted-foreground">Supports Excel (.xlsx, .xls, .csv), PDF, and Word (.docx, .doc)</p>
              <div
                className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover-elevate"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="space-y-1">
                    <FileSpreadsheet className="w-6 h-6 mx-auto text-primary" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to choose file</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf,.doc,.docx" className="hidden" onChange={handleFileChange} data-testid="input-knowledge-file" />
              </div>
              {selectedFile && (
                <div className="space-y-2">
                  <Input
                    placeholder="Source display name"
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    data-testid="input-knowledge-name"
                  />
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleUploadSubmit} disabled={uploadMutation.isPending} data-testid="button-upload-knowledge">
                      {uploadMutation.isPending ? 'Uploading...' : 'Upload & Process'}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setSelectedFile(null); setUploadName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* URL source */}
            <div className="border rounded-md p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><Globe className="w-4 h-4" />Add URL Source</p>
              <p className="text-xs text-muted-foreground">Add a web page URL — Findy will fetch and index its content</p>
              <div className="space-y-2">
                <Input
                  placeholder="https://example.com/page"
                  value={urlForm.url}
                  onChange={e => setUrlForm(f => ({ ...f, url: e.target.value }))}
                  data-testid="input-knowledge-url"
                />
                <Input
                  placeholder="Source name (optional)"
                  value={urlForm.name}
                  onChange={e => setUrlForm(f => ({ ...f, name: e.target.value }))}
                />
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => urlMutation.mutate(urlForm)}
                  disabled={!urlForm.url || urlMutation.isPending}
                  data-testid="button-add-url-knowledge"
                >
                  <Link className="w-4 h-4 mr-2" />
                  {urlMutation.isPending ? 'Adding...' : 'Add URL Source'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sources list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Uploaded Sources ({sources.length})
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => refetch()}>
            <RotateCcw className="w-3 h-3 mr-1" />Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Loading sources...</div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Database className="w-10 h-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No knowledge sources yet</p>
              <p className="text-xs text-muted-foreground">Upload an Excel file with university programs, PDFs, or add a URL</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map(src => (
                  <TableRow key={src.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(src.fileType)}
                        <div>
                          <p className="font-medium text-sm">{src.name}</p>
                          {src.originalName && <p className="text-xs text-muted-foreground">{src.originalName}</p>}
                          {src.url && <a href={src.url} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" />{src.url.slice(0, 40)}...</a>}
                          {src.errorMessage && <p className="text-xs text-destructive mt-0.5">{src.errorMessage}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{src.fileType || src.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {src.status === 'active' ? (
                        <div>
                          <span className="font-medium">{(src.rowCount || 0).toLocaleString()}</span>
                          <span className="text-muted-foreground"> rows</span>
                          <br />
                          <span className="text-xs text-muted-foreground">{(src.chunkCount || 0).toLocaleString()} chunks</span>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(src.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{dayjs(src.createdAt).format('MMM D, YYYY')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {(src.status === 'error' || src.status === 'active') && (
                          <Button size="icon" variant="ghost" onClick={() => reprocessMutation.mutate(src.id)} disabled={reprocessMutation.isPending} title="Reprocess">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(src.id)} disabled={deleteMutation.isPending} className="text-destructive" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Debug test panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="w-4 h-4" />
            Last Search Debug
          </CardTitle>
          <CardDescription>
            Send a test query to see which knowledge chunks are retrieved and their match scores. Only visible to admins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Type a test query (e.g. computer engineering Latvia fees)..."
              value={testQuery}
              onChange={e => setTestQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDebugSearch()}
              data-testid="input-debug-query"
            />
            <Button onClick={handleDebugSearch} disabled={testLoading || !testQuery.trim()} data-testid="button-debug-search">
              {testLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {debugResult && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Query: <span className="text-foreground font-semibold">"{debugResult.query}"</span>
                {' — '}
                <span>{debugResult.chunks.length === 0 ? 'No chunks retrieved' : `${debugResult.chunks.length} chunk${debugResult.chunks.length !== 1 ? 's' : ''} retrieved`}</span>
              </p>
              {debugResult.chunks.length > 0 ? (
                <div className="space-y-2">
                  {debugResult.chunks.map((chunk, i) => (
                    <div key={chunk.id} className="rounded-md border p-3 space-y-1.5 bg-muted/20">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">#{i + 1} · {chunk.id.slice(0, 8)}…</span>
                        <Badge variant="outline" className="text-xs font-mono">
                          score: {chunk.score.toFixed(2)}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground leading-snug">
                        {chunk.preview}{chunk.preview.length >= 80 ? '…' : ''}
                      </p>
                      {chunk.matchedTerms.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {chunk.matchedTerms.map(term => (
                            <Badge key={term} variant="secondary" className="text-xs font-mono">
                              {term}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border p-4 text-center text-sm text-muted-foreground bg-muted/20">
                  No knowledge chunks matched this query. Try different keywords or check that sources are uploaded and active.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
