import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, XCircle, Clock, Zap, ChevronDown } from 'lucide-react';

interface IntegrationEvent {
  id: string;
  integrationId?: string;
  integrationName?: string;
  eventType: string;
  method: string;
  targetUrl?: string;
  requestPayload?: string;
  responseStatus?: number;
  responseBody?: string;
  hmacHeader?: string;
  durationMs?: number;
  status: string;
  retryCount: number;
  errorMessage?: string;
  triggeredBy?: string;
  createdAt: string;
}

interface Integration {
  id: string;
  name: string;
  displayName?: string;
}

const statusBadge = (status: string) => {
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    success: 'default',
    failed: 'destructive',
    pending: 'secondary',
    retrying: 'outline',
  };
  const icon = {
    success: <CheckCircle className="w-3 h-3 mr-1" />,
    failed: <XCircle className="w-3 h-3 mr-1" />,
    pending: <Clock className="w-3 h-3 mr-1" />,
    retrying: <RefreshCw className="w-3 h-3 mr-1" />,
  }[status] ?? null;
  return (
    <Badge variant={map[status] || 'secondary'} className="flex items-center gap-0.5">
      {icon}{status}
    </Badge>
  );
};

const EVENT_TYPES = [
  'agent.enrolled', 'agent.registered', 'quiz.passed', 'quiz.failed',
  'certificate.issued', 'course.completed', 'user.created', 'test'
];

export function IntegrationEventLog({ integrations }: { integrations: Integration[] }) {
  const { toast } = useToast();
  const [filterIntegration, setFilterIntegration] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<IntegrationEvent | null>(null);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerIntegrationId, setTriggerIntegrationId] = useState('');
  const [triggerEventType, setTriggerEventType] = useState('test');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/integration-events', filterIntegration, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterIntegration !== 'all') params.set('integration_id', filterIntegration);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      params.set('limit', '100');
      const res = await fetch(`/api/admin/integration-events?${params}`, {
        headers: { 'x-user-id': JSON.parse(sessionStorage.getItem('fas_session') || '{}')?.user?.id || '' },
      });
      return res.json();
    },
    refetchInterval: 30000,
  });

  const triggerMutation = useMutation({
    mutationFn: async () =>
      apiRequest('POST', '/api/admin/integration-events/trigger', {
        integrationId: triggerIntegrationId,
        eventType: triggerEventType,
      }),
    onSuccess: (data: any) => {
      toast({ title: data.success ? 'Webhook Sent' : 'Webhook Failed', description: data.success ? `HTTP ${data.event?.responseStatus}` : data.message, variant: data.success ? 'default' : 'destructive' });
      setTriggerOpen(false);
      refetch();
    },
  });

  const events: IntegrationEvent[] = data?.events || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={filterIntegration} onValueChange={setFilterIntegration}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-integration">
              <SelectValue placeholder="All Integrations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Integrations</SelectItem>
              {integrations.map(i => (
                <SelectItem key={i.id} value={i.id}>{i.displayName || i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="default" onClick={() => refetch()} data-testid="button-refresh-events">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setTriggerOpen(true)} data-testid="button-trigger-webhook">
            <Zap className="w-4 h-4 mr-2" /> Trigger Webhook
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No events found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Integration</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map(event => (
                    <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                      <TableCell>{statusBadge(event.status)}</TableCell>
                      <TableCell className="font-mono text-xs">{event.eventType}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{event.integrationName || '-'}</TableCell>
                      <TableCell>
                        {event.responseStatus ? (
                          <Badge variant={event.responseStatus < 400 ? 'default' : 'destructive'} className="text-xs">
                            {event.responseStatus}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {event.durationMs ? `${event.durationMs}ms` : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setSelectedEvent(event)} data-testid={`button-event-detail-${event.id}`}>
                          <ChevronDown className="w-4 h-4" />
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

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook Event Detail</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Status</span><div>{statusBadge(selectedEvent.status)}</div></div>
                <div><span className="text-muted-foreground">Event Type</span><div className="font-mono">{selectedEvent.eventType}</div></div>
                <div><span className="text-muted-foreground">Integration</span><div>{selectedEvent.integrationName || '-'}</div></div>
                <div><span className="text-muted-foreground">HTTP Status</span><div>{selectedEvent.responseStatus || '-'}</div></div>
                <div><span className="text-muted-foreground">Duration</span><div>{selectedEvent.durationMs ? `${selectedEvent.durationMs}ms` : '-'}</div></div>
                <div><span className="text-muted-foreground">Retries</span><div>{selectedEvent.retryCount}</div></div>
              </div>
              <div><span className="text-muted-foreground">Target URL</span><div className="font-mono text-xs break-all">{selectedEvent.targetUrl || '-'}</div></div>
              {selectedEvent.hmacHeader && (
                <div><span className="text-muted-foreground">HMAC Signature</span><div className="font-mono text-xs break-all">{selectedEvent.hmacHeader}</div></div>
              )}
              {selectedEvent.requestPayload && (
                <div>
                  <span className="text-muted-foreground">Request Payload</span>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto max-h-[120px]">{JSON.stringify(JSON.parse(selectedEvent.requestPayload), null, 2)}</pre>
                </div>
              )}
              {selectedEvent.responseBody && (
                <div>
                  <span className="text-muted-foreground">Response Body</span>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto max-h-[120px]">{selectedEvent.responseBody}</pre>
                </div>
              )}
              {selectedEvent.errorMessage && (
                <div><span className="text-muted-foreground">Error</span><div className="text-destructive">{selectedEvent.errorMessage}</div></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Trigger Webhook Dialog */}
      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trigger Webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Integration</label>
              <Select value={triggerIntegrationId} onValueChange={setTriggerIntegrationId}>
                <SelectTrigger className="mt-1" data-testid="select-trigger-integration">
                  <SelectValue placeholder="Select integration..." />
                </SelectTrigger>
                <SelectContent>
                  {integrations.filter(i => (i as any).endpointUrl).map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.displayName || i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Event Type</label>
              <Select value={triggerEventType} onValueChange={setTriggerEventType}>
                <SelectTrigger className="mt-1" data-testid="select-trigger-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTriggerOpen(false)}>Cancel</Button>
              <Button
                onClick={() => triggerMutation.mutate()}
                disabled={!triggerIntegrationId || triggerMutation.isPending}
                data-testid="button-confirm-trigger"
              >
                {triggerMutation.isPending ? 'Sending...' : 'Send Webhook'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
