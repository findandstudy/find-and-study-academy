import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Megaphone, Plus, Edit, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

interface Popup {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkText: string | null;
  targetAudience: 'all' | 'agents' | 'specific';
  targetAgencyIds: string[] | null;
  status: 'draft' | 'active' | 'archived';
  startsAt: string | null;
  expiresAt: string | null;
  frequency: 'every_session' | 'every_login' | 'once_per_user';
  createdAt: string;
  creatorName?: string;
}

interface Agency {
  id: string;
  name: string;
}

interface FormState {
  title: string;
  content: string;
  imageUrl: string;
  linkUrl: string;
  linkText: string;
  targetAudience: Popup['targetAudience'];
  targetAgencyIds: string[];
  status: Popup['status'];
  startsAt: string;
  expiresAt: string;
  frequency: Popup['frequency'];
}

const STATUS_VARIANT: Record<Popup['status'], 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  draft: 'secondary',
  archived: 'outline',
};

const emptyForm: FormState = {
  title: '',
  content: '',
  imageUrl: '',
  linkUrl: '',
  linkText: '',
  targetAudience: 'all',
  targetAgencyIds: [],
  status: 'draft',
  startsAt: '',
  expiresAt: '',
  frequency: 'every_session',
};

function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function popupToForm(p: Popup): FormState {
  return {
    title: p.title,
    content: p.content,
    imageUrl: p.imageUrl ?? '',
    linkUrl: p.linkUrl ?? '',
    linkText: p.linkText ?? '',
    targetAudience: p.targetAudience,
    targetAgencyIds: p.targetAgencyIds ?? [],
    status: p.status,
    startsAt: toLocalDateTimeInput(p.startsAt),
    expiresAt: toLocalDateTimeInput(p.expiresAt),
    frequency: p.frequency,
  };
}

export default function AdminPopups() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<Popup | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; popups: Popup[] }>({
    queryKey: ['/api/admin/popups'],
  });
  const popups = data?.popups ?? [];

  const { data: agenciesData } = useQuery<{ success: boolean; agencies: Agency[] }>({
    queryKey: ['/api/admin/agencies'],
  });
  const agencies = agenciesData?.agencies ?? [];

  type PopupPayload = {
    title: string;
    content: string;
    imageUrl: string | null;
    linkUrl: string | null;
    linkText: string | null;
    targetAudience: Popup['targetAudience'];
    targetAgencyIds: string[] | null;
    status: Popup['status'];
    startsAt: string | null;
    expiresAt: string | null;
    frequency: Popup['frequency'];
  };

  const errorMessage = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : fallback;

  const createMut = useMutation({
    mutationFn: (payload: PopupPayload) => apiRequest('POST', '/api/admin/popups', payload),
    onSuccess: () => {
      toast({ title: t('admin.popups.created') });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/popups'] });
      setIsCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (e: unknown) => toast({
      title: t('common.error'),
      description: errorMessage(e, t('admin.popups.createFailed')),
      variant: 'destructive',
    }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PopupPayload }) =>
      apiRequest('PUT', `/api/admin/popups/${id}`, payload),
    onSuccess: () => {
      toast({ title: t('admin.popups.updated') });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/popups'] });
      setIsEditOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: unknown) => toast({
      title: t('common.error'),
      description: errorMessage(e, t('admin.popups.updateFailed')),
      variant: 'destructive',
    }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/popups/${id}`),
    onSuccess: () => {
      toast({ title: t('admin.popups.deleted') });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/popups'] });
    },
    onError: (e: unknown) => toast({
      title: t('common.error'),
      description: errorMessage(e, t('admin.popups.deleteFailed')),
      variant: 'destructive',
    }),
  });

  const buildPayload = (s: FormState) => ({
    title: s.title.trim(),
    content: s.content.trim(),
    imageUrl: s.imageUrl.trim() || null,
    linkUrl: s.linkUrl.trim() || null,
    linkText: s.linkText.trim() || null,
    targetAudience: s.targetAudience,
    targetAgencyIds: s.targetAudience === 'specific' ? s.targetAgencyIds : null,
    status: s.status,
    startsAt: s.startsAt ? new Date(s.startsAt).toISOString() : null,
    expiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : null,
    frequency: s.frequency,
  });

  const handleCreate = () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: t('common.error'), description: t('admin.popups.validationError'), variant: 'destructive' });
      return;
    }
    createMut.mutate(buildPayload(form));
  };

  const handleUpdate = () => {
    if (!editing) return;
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: t('common.error'), description: t('admin.popups.validationError'), variant: 'destructive' });
      return;
    }
    updateMut.mutate({ id: editing.id, payload: buildPayload(form) });
  };

  const openEdit = (p: Popup) => {
    setEditing(p);
    setForm(popupToForm(p));
    setIsEditOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const sessionRaw = localStorage.getItem('fas_session');
      const session = sessionRaw ? JSON.parse(sessionRaw) : null;
      const userId = session?.user?.id ? String(session.user.id) : '';
      const res = await fetch('/api/uploads/content', {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      const url = json?.url || json?.fileUrl || json?.path;
      if (!url) throw new Error('URL not returned');
      setForm((f) => ({ ...f, imageUrl: url }));
      toast({ title: t('admin.popups.imageUploaded') });
    } catch (e: unknown) {
      toast({
        title: t('admin.popups.imageUploadFailed'),
        description: errorMessage(e, t('admin.popups.createFailed')),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="popup-title">{t('admin.popups.titleLabel')}</Label>
        <Input
          id="popup-title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          data-testid="input-popup-title"
        />
      </div>

      <div>
        <Label htmlFor="popup-content">{t('admin.popups.contentLabel')}</Label>
        <Textarea
          id="popup-content"
          rows={5}
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          data-testid="input-popup-content"
        />
      </div>

      <div>
        <Label>{t('admin.popups.imageLabel')}</Label>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="https://..."
            value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            data-testid="input-popup-image-url"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="button-popup-upload-image"
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
            {t('admin.popups.upload')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f);
              e.target.value = '';
            }}
          />
        </div>
        {form.imageUrl && (
          <div className="mt-2 rounded-md overflow-hidden border border-border max-w-xs">
            <img src={form.imageUrl} alt="preview" className="w-full h-auto object-cover max-h-40" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="popup-link-url">{t('admin.popups.linkUrlLabel')}</Label>
          <Input
            id="popup-link-url"
            placeholder="https://..."
            value={form.linkUrl}
            onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
            data-testid="input-popup-link-url"
          />
        </div>
        <div>
          <Label htmlFor="popup-link-text">{t('admin.popups.linkTextLabel')}</Label>
          <Input
            id="popup-link-text"
            placeholder={t('admin.popups.linkTextPlaceholder')}
            value={form.linkText}
            onChange={(e) => setForm((f) => ({ ...f, linkText: e.target.value }))}
            data-testid="input-popup-link-text"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>{t('admin.popups.audienceLabel')}</Label>
          <Select
            value={form.targetAudience}
            onValueChange={(v: Popup['targetAudience']) =>
              setForm((f) => ({ ...f, targetAudience: v, targetAgencyIds: v === 'specific' ? f.targetAgencyIds : [] }))
            }
          >
            <SelectTrigger data-testid="select-popup-audience"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.popups.audienceAll')}</SelectItem>
              <SelectItem value="agents">{t('admin.popups.audienceAgents')}</SelectItem>
              <SelectItem value="specific">{t('admin.popups.audienceSpecific')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t('admin.popups.frequencyLabel')}</Label>
          <Select
            value={form.frequency}
            onValueChange={(v: Popup['frequency']) => setForm((f) => ({ ...f, frequency: v }))}
          >
            <SelectTrigger data-testid="select-popup-frequency"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="every_session">{t('admin.popups.freqSession')}</SelectItem>
              <SelectItem value="every_login">{t('admin.popups.freqLogin')}</SelectItem>
              <SelectItem value="once_per_user">{t('admin.popups.freqOnce')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t('admin.popups.statusLabel')}</Label>
          <Select
            value={form.status}
            onValueChange={(v: Popup['status']) => setForm((f) => ({ ...f, status: v }))}
          >
            <SelectTrigger data-testid="select-popup-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t('admin.popups.statusDraft')}</SelectItem>
              <SelectItem value="active">{t('admin.popups.statusActive')}</SelectItem>
              <SelectItem value="archived">{t('admin.popups.statusArchived')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.targetAudience === 'specific' && (
        <div>
          <Label>{t('admin.popups.agenciesLabel')}</Label>
          <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
            {agencies.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('admin.popups.noAgencies')}</p>
            )}
            {agencies.map((a) => {
              const checked = form.targetAgencyIds.includes(a.id);
              return (
                <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        targetAgencyIds: v
                          ? [...f.targetAgencyIds, a.id]
                          : f.targetAgencyIds.filter((id) => id !== a.id),
                      }))
                    }
                  />
                  {a.name}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="popup-starts-at">{t('admin.popups.startsAt')}</Label>
          <Input
            id="popup-starts-at"
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            data-testid="input-popup-starts-at"
          />
        </div>
        <div>
          <Label htmlFor="popup-expires-at">{t('admin.popups.expiresAt')}</Label>
          <Input
            id="popup-expires-at"
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            data-testid="input-popup-expires-at"
          />
        </div>
      </div>
    </div>
  );

  const freqLabel: Record<Popup['frequency'], string> = {
    every_session: t('admin.popups.freqLabelSession'),
    every_login: t('admin.popups.freqLabelLogin'),
    once_per_user: t('admin.popups.freqLabelOnce'),
  };
  const audienceLabel: Record<Popup['targetAudience'], string> = {
    all: t('admin.popups.audienceLabelAll'),
    agents: t('admin.popups.audienceLabelAgents'),
    specific: t('admin.popups.audienceLabelSpecific'),
  };
  const statusLabel: Record<Popup['status'], string> = {
    active: t('admin.popups.statusLabelActive'),
    draft: t('admin.popups.statusLabelDraft'),
    archived: t('admin.popups.statusLabelArchived'),
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="heading-popups">
            {t('admin.popups.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.popups.subtitle')}
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (o) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-popup">
              <Plus className="w-4 h-4 mr-2" />
              {t('admin.popups.newPopup')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('admin.popups.createTitle')}</DialogTitle>
            </DialogHeader>
            {renderForm()}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                {t('admin.popups.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={createMut.isPending} data-testid="button-submit-create-popup">
                {createMut.isPending ? t('admin.popups.creating') : t('admin.popups.create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            {t('admin.popups.listTitle', { count: popups.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[0,1,2].map((i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
            </div>
          ) : popups.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{t('admin.popups.empty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.popups.colTitle')}</TableHead>
                    <TableHead>{t('admin.popups.colAudience')}</TableHead>
                    <TableHead>{t('admin.popups.colFrequency')}</TableHead>
                    <TableHead>{t('admin.popups.colStatus')}</TableHead>
                    <TableHead>{t('admin.popups.colDateRange')}</TableHead>
                    <TableHead>{t('admin.popups.colCreated')}</TableHead>
                    <TableHead className="text-right">{t('admin.popups.colAction')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {popups.map((p) => (
                    <TableRow key={p.id} data-testid={`row-popup-${p.id}`}>
                      <TableCell className="font-medium max-w-xs">
                        <div className="font-medium truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.content}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{audienceLabel[p.targetAudience]}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{freqLabel[p.frequency]}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[p.status]}>{statusLabel[p.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.startsAt ? dayjs(p.startsAt).format('DD MMM YYYY') : '—'}
                        {' → '}
                        {p.expiresAt ? dayjs(p.expiresAt).format('DD MMM YYYY') : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {dayjs(p.createdAt).format('DD MMM YYYY')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(p)}
                            data-testid={`button-edit-${p.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-delete-${p.id}`}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('admin.popups.deleteTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('admin.popups.deleteDesc', { title: p.title })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('admin.popups.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMut.mutate(p.id)}
                                  data-testid={`button-confirm-delete-${p.id}`}
                                >
                                  {t('admin.popups.delete')}
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

      <Dialog open={isEditOpen} onOpenChange={(o) => { if (!o) { setIsEditOpen(false); setEditing(null); } else setIsEditOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.popups.editTitle')}</DialogTitle>
          </DialogHeader>
          {renderForm()}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditing(null); }}>
              {t('admin.popups.cancel')}
            </Button>
            <Button onClick={handleUpdate} disabled={updateMut.isPending} data-testid="button-submit-edit-popup">
              {updateMut.isPending ? t('admin.popups.saving') : t('admin.popups.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
