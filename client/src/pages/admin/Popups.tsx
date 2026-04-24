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

const FREQ_LABEL: Record<Popup['frequency'], string> = {
  every_session: 'Her oturum',
  every_login: 'Her giriş',
  once_per_user: 'Bir kez',
};

const AUDIENCE_LABEL: Record<Popup['targetAudience'], string> = {
  all: 'Tümü',
  agents: 'Acenteler',
  specific: 'Belirli Acenteler',
};

const STATUS_VARIANT: Record<Popup['status'], 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  draft: 'secondary',
  archived: 'outline',
};

const STATUS_LABEL: Record<Popup['status'], string> = {
  active: 'Aktif',
  draft: 'Taslak',
  archived: 'Arşivli',
};

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
      toast({ title: 'Pop-up oluşturuldu' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/popups'] });
      setIsCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (e: unknown) => toast({ title: 'Hata', description: errorMessage(e, 'Oluşturulamadı'), variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PopupPayload }) =>
      apiRequest('PUT', `/api/admin/popups/${id}`, payload),
    onSuccess: () => {
      toast({ title: 'Pop-up güncellendi' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/popups'] });
      setIsEditOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: unknown) => toast({ title: 'Hata', description: errorMessage(e, 'Güncellenemedi'), variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/popups/${id}`),
    onSuccess: () => {
      toast({ title: 'Pop-up silindi' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/popups'] });
    },
    onError: (e: unknown) => toast({ title: 'Hata', description: errorMessage(e, 'Silinemedi'), variant: 'destructive' }),
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
      toast({ title: 'Hata', description: 'Başlık ve içerik zorunludur', variant: 'destructive' });
      return;
    }
    createMut.mutate(buildPayload(form));
  };

  const handleUpdate = () => {
    if (!editing) return;
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: 'Hata', description: 'Başlık ve içerik zorunludur', variant: 'destructive' });
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
      toast({ title: 'Görsel yüklendi' });
    } catch (e: unknown) {
      toast({ title: 'Yükleme hatası', description: errorMessage(e, 'Yüklenemedi'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="popup-title">Başlık *</Label>
        <Input
          id="popup-title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          data-testid="input-popup-title"
        />
      </div>

      <div>
        <Label htmlFor="popup-content">İçerik *</Label>
        <Textarea
          id="popup-content"
          rows={5}
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          data-testid="input-popup-content"
        />
      </div>

      <div>
        <Label>Görsel (opsiyonel)</Label>
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
            Yükle
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
          <Label htmlFor="popup-link-url">Link URL (opsiyonel)</Label>
          <Input
            id="popup-link-url"
            placeholder="https://..."
            value={form.linkUrl}
            onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
            data-testid="input-popup-link-url"
          />
        </div>
        <div>
          <Label htmlFor="popup-link-text">Link Metni</Label>
          <Input
            id="popup-link-text"
            placeholder="Daha fazla bilgi"
            value={form.linkText}
            onChange={(e) => setForm((f) => ({ ...f, linkText: e.target.value }))}
            data-testid="input-popup-link-text"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>Hedef Kitle</Label>
          <Select
            value={form.targetAudience}
            onValueChange={(v: Popup['targetAudience']) =>
              setForm((f) => ({ ...f, targetAudience: v, targetAgencyIds: v === 'specific' ? f.targetAgencyIds : [] }))
            }
          >
            <SelectTrigger data-testid="select-popup-audience"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="agents">Tüm Acenteler</SelectItem>
              <SelectItem value="specific">Belirli Acenteler</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Sıklık</Label>
          <Select
            value={form.frequency}
            onValueChange={(v: Popup['frequency']) => setForm((f) => ({ ...f, frequency: v }))}
          >
            <SelectTrigger data-testid="select-popup-frequency"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="every_session">Her oturum</SelectItem>
              <SelectItem value="every_login">Her giriş</SelectItem>
              <SelectItem value="once_per_user">Kullanıcı başına bir kez</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Durum</Label>
          <Select
            value={form.status}
            onValueChange={(v: Popup['status']) => setForm((f) => ({ ...f, status: v }))}
          >
            <SelectTrigger data-testid="select-popup-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Taslak</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="archived">Arşivli</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.targetAudience === 'specific' && (
        <div>
          <Label>Acenteler</Label>
          <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
            {agencies.length === 0 && (
              <p className="text-sm text-muted-foreground">Acente bulunamadı.</p>
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
          <Label htmlFor="popup-starts-at">Başlangıç (opsiyonel)</Label>
          <Input
            id="popup-starts-at"
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            data-testid="input-popup-starts-at"
          />
        </div>
        <div>
          <Label htmlFor="popup-expires-at">Bitiş (opsiyonel)</Label>
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="heading-popups">Pop-up Reklamlar</h1>
          <p className="text-muted-foreground mt-1">
            Acentelere dashboard girişinde gösterilecek modal duyuruları yönetin.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (o) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-popup">
              <Plus className="w-4 h-4 mr-2" />
              Yeni Pop-up
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Yeni Pop-up Oluştur</DialogTitle>
            </DialogHeader>
            {renderForm()}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>İptal</Button>
              <Button onClick={handleCreate} disabled={createMut.isPending} data-testid="button-submit-create-popup">
                {createMut.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Pop-up Listesi ({popups.length})
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
              <p className="text-muted-foreground">Henüz hiç pop-up oluşturulmadı.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Başlık</TableHead>
                    <TableHead>Hedef</TableHead>
                    <TableHead>Sıklık</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tarih Aralığı</TableHead>
                    <TableHead>Oluşturulma</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {popups.map((p) => (
                    <TableRow key={p.id} data-testid={`row-popup-${p.id}`}>
                      <TableCell className="font-medium max-w-xs">
                        <div className="font-medium truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.content}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{AUDIENCE_LABEL[p.targetAudience]}</Badge></TableCell>
                      <TableCell><span className="text-sm">{FREQ_LABEL[p.frequency]}</span></TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge></TableCell>
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
                                <AlertDialogTitle>Pop-up'ı sil?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{p.title}" silinecek. Bu işlem geri alınamaz.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMut.mutate(p.id)}
                                  data-testid={`button-confirm-delete-${p.id}`}
                                >
                                  Sil
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
            <DialogTitle>Pop-up'ı Düzenle</DialogTitle>
          </DialogHeader>
          {renderForm()}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditing(null); }}>İptal</Button>
            <Button onClick={handleUpdate} disabled={updateMut.isPending} data-testid="button-submit-edit-popup">
              {updateMut.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
