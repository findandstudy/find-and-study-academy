import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Plus, Copy, Trash2, Key, CheckCircle, RefreshCw } from 'lucide-react';

const SCOPES = [
  'content:read', 'content:write',
  'users:read', 'users:write',
  'analytics:read', 'webhooks:write',
  'certificates:read', 'admin:read',
];

interface IntegrationApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes?: string[] | null;
  integrationId?: string | null;
  isActive: boolean;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdBy: string;
  createdAt: string;
  revokedAt?: string | null;
}

interface Integration {
  id: string;
  name: string;
  displayName?: string;
}

export function IntegrationApiKeys({ integrations }: { integrations: Integration[] }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [newKeyIntegration, setNewKeyIntegration] = useState('none');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/integration-api-keys', showRevoked],
    queryFn: async () => {
      const url = showRevoked ? '/api/admin/integration-api-keys?include_revoked=true' : '/api/admin/integration-api-keys';
      const res = await fetch(url, {
        headers: { 'x-user-id': JSON.parse(sessionStorage.getItem('fas_session') || '{}')?.user?.id || '' },
      });
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiRequest('POST', '/api/admin/integration-api-keys', {
        name: newKeyName,
        scopes: newKeyScopes.length > 0 ? newKeyScopes : null,
        integrationId: newKeyIntegration !== 'none' ? newKeyIntegration : null,
      }),
    onSuccess: (data: any) => {
      setGeneratedKey(data.rawKey);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/integration-api-keys'] });
    },
    onError: () => {
      toast({ title: 'Failed to create API key', variant: 'destructive' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/integration-api-keys/${id}`),
    onSuccess: () => {
      toast({ title: 'API key revoked' });
      refetch();
    },
    onError: () => {
      toast({ title: 'Failed to revoke key', variant: 'destructive' });
    },
  });

  const copyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      toast({ title: 'Key name is required', variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setNewKeyName('');
    setNewKeyScopes([]);
    setNewKeyIntegration('none');
    setGeneratedKey(null);
    setCopied(false);
  };

  const keys: IntegrationApiKey[] = data?.keys || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={showRevoked ? 'default' : 'outline'}
            onClick={() => setShowRevoked(v => !v)}
            data-testid="button-toggle-revoked"
          >
            {showRevoked ? 'Hide Revoked' : 'Show Revoked'}
          </Button>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-api-key">
          <Plus className="w-4 h-4 mr-2" /> Create API Key
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No API keys yet. Create one to enable external access.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key Prefix</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id} data-testid={`row-key-${key.id}`}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell className="font-mono text-xs">{key.keyPrefix}...</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {key.scopes?.map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)
                          ?? <span className="text-muted-foreground text-xs">All scopes</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={key.isActive ? 'default' : 'destructive'}>
                          {key.isActive ? 'Active' : 'Revoked'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {key.isActive && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-revoke-${key.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently revoke "{key.name}". Any applications using this key will lose access.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => revokeMutation.mutate(key.id)}>
                                  Revoke Key
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={createOpen} onOpenChange={handleCloseCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{generatedKey ? 'Save Your API Key' : 'Create API Key'}</DialogTitle>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-800 dark:text-amber-300">
                This key will only be shown once. Copy and store it securely.
              </div>
              <div className="flex gap-2">
                <Input value={generatedKey} readOnly className="font-mono text-xs" data-testid="input-generated-key" />
                <Button size="default" variant="outline" onClick={copyKey} data-testid="button-copy-key">
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <Button className="w-full" onClick={handleCloseCreate} data-testid="button-done-key">Done</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Key Name</label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Production Webhook, CRM Sync"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  data-testid="input-key-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Linked Integration <span className="text-muted-foreground text-xs">(optional)</span></label>
                <Select value={newKeyIntegration} onValueChange={setNewKeyIntegration}>
                  <SelectTrigger className="mt-1" data-testid="select-key-integration">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {integrations.map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.displayName || i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Permission Scopes <span className="text-muted-foreground text-xs">(empty = all)</span></label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {SCOPES.map(scope => (
                    <label key={scope} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        data-testid={`checkbox-scope-${scope.replace(':', '-')}`}
                      />
                      <span className="font-mono text-xs">{scope}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseCreate}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-confirm-create-key">
                  {createMutation.isPending ? 'Creating...' : 'Create Key'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
