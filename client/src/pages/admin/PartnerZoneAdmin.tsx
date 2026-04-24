import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Package, Plus, Edit2, Trash2, Upload, Folder, FolderOpen,
  FileText, Globe, Tag, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  ChevronLeft, Video, Image, File, Link2, Download, ImageIcon
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import dayjs from 'dayjs';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PartnerFolder {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  countryCode: string | null;
  categoryTag: string | null;
  status: string;
  order: number;
  contentCount?: number;
  updatedAt: string;
  createdAt: string;
}

interface FolderContent {
  id: string;
  title: string;
  description: string | null;
  contentType: string | null;
  type: string;
  status: string;
  documentUrl: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  displayName: string | null;
  fileSize: string | null;
  folderId: string | null;
  updatedAt: string;
}

type MediaType = 'document' | 'video' | 'image';

const MEDIA_TYPES: { value: MediaType; label: string; icon: React.ElementType; accept: string; folder: string }[] = [
  { value: 'document', label: 'Belge', icon: FileText, accept: '.pdf,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.zip', folder: 'documents' },
  { value: 'video',    label: 'Video',  icon: Video,    accept: '.mp4,.mov,.webm,.avi,.mkv',                  folder: 'videos'    },
  { value: 'image',    label: 'Görsel', icon: Image,    accept: '.jpg,.jpeg,.png,.gif,.webp,.svg',             folder: 'images'    },
];

function getContentUrl(item: FolderContent): string | null {
  return item.documentUrl ?? item.videoUrl ?? item.imageUrl ?? null;
}

function getContentType(item: FolderContent): MediaType {
  const t = item.contentType ?? item.type;
  if (t === 'video') return 'video';
  if (t === 'image') return 'image';
  return 'document';
}

function ContentIcon({ type, className }: { type: MediaType; className?: string }) {
  const Icon = MEDIA_TYPES.find(m => m.value === type)?.icon ?? File;
  return <Icon className={className} />;
}

// ─── Folder form ────────────────────────────────────────────────────────────

const folderSchema = z.object({
  name: z.string().min(1, 'Klasör adı zorunlu'),
  description: z.string().optional(),
  categoryTag: z.string().optional(),
  countryCode: z.string().optional(),
  order: z.coerce.number().default(0),
  status: z.enum(['draft', 'published']),
});
type FolderFormValues = z.infer<typeof folderSchema>;

// ─── Content form ───────────────────────────────────────────────────────────

const contentSchema = z.object({
  mediaType: z.enum(['document', 'video', 'image']),
  title: z.string().min(1, 'Başlık zorunlu'),
  description: z.string().optional(),
  displayName: z.string().optional(),
  fileSize: z.string().optional(),
  fileUrl: z.string().optional(),
  status: z.enum(['draft', 'published']),
});
type ContentFormValues = z.infer<typeof contentSchema>;

// ─── Main component ─────────────────────────────────────────────────────────

export default function PartnerZoneAdmin() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Navigation state: null = folder list, string = folder detail
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

  // Folder CRUD state
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<PartnerFolder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<PartnerFolder | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Content CRUD state (inside a folder)
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<FolderContent | null>(null);
  const [deleteContent, setDeleteContent] = useState<FolderContent | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ────────────────────────────────────────────────────────────

  const { data: foldersData, isLoading: foldersLoading } = useQuery<{ success: boolean; folders: PartnerFolder[] }>({
    queryKey: ['/api/admin/partner-folders'],
    queryFn: async () => { const r = await apiRequest('GET', '/api/admin/partner-folders'); return r.json(); },
  });

  const { data: folderDetailData, isLoading: detailLoading } = useQuery<{ success: boolean; folder: PartnerFolder; contents: FolderContent[] }>({
    queryKey: ['/api/admin/partner-folders', openFolderId],
    queryFn: async () => { const r = await apiRequest('GET', `/api/admin/partner-folders/${openFolderId}`); return r.json(); },
    enabled: !!openFolderId,
  });

  const folders = foldersData?.folders ?? [];
  const openFolder = folderDetailData?.folder ?? null;
  const folderContents = folderDetailData?.contents ?? [];

  // ─── Folder form ─────────────────────────────────────────────────────────

  const folderForm = useForm<FolderFormValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: { name: '', description: '', categoryTag: '', countryCode: '', order: 0, status: 'draft' },
  });
  const folderCoverUrl = folderForm.watch('status'); // just to re-render on status change

  const openCreateFolder = () => {
    setEditingFolder(null);
    setCoverPreview(null);
    folderForm.reset({ name: '', description: '', categoryTag: '', countryCode: '', order: folders.length, status: 'draft' });
    setFolderDialogOpen(true);
  };

  const openEditFolder = (f: PartnerFolder) => {
    setEditingFolder(f);
    setCoverPreview(f.coverImageUrl);
    folderForm.reset({ name: f.name, description: f.description ?? '', categoryTag: f.categoryTag ?? '', countryCode: f.countryCode ?? '', order: f.order, status: f.status as 'draft' | 'published' });
    setFolderDialogOpen(true);
  };

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'images');
      const res = await fetch('/api/uploads/content', {
        method: 'POST',
        headers: { 'x-user-id': user?.id ?? '', 'x-user-role': user?.role ?? '' },
        body: fd,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.url) {
        setCoverPreview(data.url);
        // store url in a transient ref — we'll attach on submit
        (window as any).__pendingCoverUrl = data.url;
        toast({ title: 'Kapak yüklendi' });
      }
    } catch {
      toast({ title: 'Yükleme hatası', variant: 'destructive' });
    } finally {
      setCoverUploading(false);
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: async (values: FolderFormValues) => {
      const payload = { ...values, coverImageUrl: (window as any).__pendingCoverUrl ?? null };
      delete (window as any).__pendingCoverUrl;
      const r = await apiRequest('POST', '/api/admin/partner-folders', payload);
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders'] }); toast({ title: 'Klasör oluşturuldu' }); setFolderDialogOpen(false); },
    onError: () => toast({ title: 'Hata', description: 'Klasör oluşturulamadı', variant: 'destructive' }),
  });

  const updateFolderMutation = useMutation({
    mutationFn: async (values: FolderFormValues) => {
      if (!editingFolder) return;
      const payload: any = { ...values };
      const pendingCover = (window as any).__pendingCoverUrl;
      if (pendingCover) { payload.coverImageUrl = pendingCover; delete (window as any).__pendingCoverUrl; }
      const r = await apiRequest('PATCH', `/api/admin/partner-folders/${editingFolder.id}`, payload);
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders'] }); toast({ title: 'Klasör güncellendi' }); setFolderDialogOpen(false); },
    onError: () => toast({ title: 'Hata', description: 'Güncellenemedi', variant: 'destructive' }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest('DELETE', `/api/admin/partner-folders/${id}`); if (!r.ok) throw new Error(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders'] }); toast({ title: 'Klasör silindi' }); setDeleteFolder(null); if (openFolderId) setOpenFolderId(null); },
    onError: () => toast({ title: 'Hata', variant: 'destructive' }),
  });

  const toggleFolderStatus = useMutation({
    mutationFn: async (f: PartnerFolder) => {
      const r = await apiRequest('PATCH', `/api/admin/partner-folders/${f.id}`, { status: f.status === 'published' ? 'draft' : 'published' });
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders'] }); },
  });

  const onFolderSubmit = (values: FolderFormValues) => {
    if (editingFolder) updateFolderMutation.mutate(values);
    else createFolderMutation.mutate(values);
  };

  // ─── Content form (inside folder) ────────────────────────────────────────

  const contentForm = useForm<ContentFormValues>({
    resolver: zodResolver(contentSchema),
    defaultValues: { mediaType: 'document', title: '', description: '', displayName: '', fileSize: '', fileUrl: '', status: 'draft' },
  });
  const watchedMediaType = contentForm.watch('mediaType');
  const currentMediaEntry = MEDIA_TYPES.find(m => m.value === watchedMediaType) ?? MEDIA_TYPES[0];

  const openCreateContent = () => {
    setEditingContent(null);
    contentForm.reset({ mediaType: 'document', title: '', description: '', displayName: '', fileSize: '', fileUrl: '', status: 'draft' });
    setContentDialogOpen(true);
  };

  const openEditContent = (item: FolderContent) => {
    setEditingContent(item);
    contentForm.reset({
      mediaType: getContentType(item),
      title: item.title,
      description: item.description ?? '',
      displayName: item.displayName ?? '',
      fileSize: item.fileSize ?? '',
      fileUrl: getContentUrl(item) ?? '',
      status: item.status as 'draft' | 'published',
    });
    setContentDialogOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    setFileUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', currentMediaEntry.folder);
      const res = await fetch('/api/uploads/content', {
        method: 'POST',
        headers: { 'x-user-id': user?.id ?? '', 'x-user-role': user?.role ?? '' },
        body: fd,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.url) {
        contentForm.setValue('fileUrl', data.url);
        contentForm.setValue('displayName', data.originalName ?? file.name);
        const kb = file.size / 1024;
        contentForm.setValue('fileSize', kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`);
        toast({ title: 'Dosya yüklendi' });
      }
    } catch {
      toast({ title: 'Yükleme hatası', variant: 'destructive' });
    } finally {
      setFileUploading(false);
    }
  };

  const buildContentPayload = (values: ContentFormValues) => {
    const base = {
      title: values.title, description: values.description, displayName: values.displayName,
      fileSize: values.fileSize, status: values.status,
      type: values.mediaType, contentType: values.mediaType,
      language: 'tr', order: 0, folderId: openFolderId,
      slug: `partner-${Date.now()}`,
    };
    if (values.mediaType === 'video') return { ...base, videoUrl: values.fileUrl, documentUrl: null, imageUrl: null };
    if (values.mediaType === 'image') return { ...base, imageUrl: values.fileUrl, documentUrl: null, videoUrl: null };
    return { ...base, documentUrl: values.fileUrl, videoUrl: null, imageUrl: null };
  };

  const createContentMutation = useMutation({
    mutationFn: async (values: ContentFormValues) => {
      const r = await apiRequest('POST', '/api/admin/contents', buildContentPayload(values));
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', openFolderId] }); toast({ title: 'İçerik eklendi' }); setContentDialogOpen(false); },
    onError: () => toast({ title: 'Hata', description: 'İçerik eklenemedi', variant: 'destructive' }),
  });

  const updateContentMutation = useMutation({
    mutationFn: async (values: ContentFormValues) => {
      if (!editingContent) return;
      const payload = buildContentPayload(values);
      const r = await apiRequest('PATCH', `/api/admin/contents/${editingContent.id}`, payload);
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', openFolderId] }); toast({ title: 'İçerik güncellendi' }); setContentDialogOpen(false); },
    onError: () => toast({ title: 'Hata', variant: 'destructive' }),
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest('DELETE', `/api/admin/contents/${id}`); if (!r.ok) throw new Error(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', openFolderId] }); toast({ title: 'İçerik silindi' }); setDeleteContent(null); },
    onError: () => toast({ title: 'Hata', variant: 'destructive' }),
  });

  const onContentSubmit = (values: ContentFormValues) => {
    if (editingContent) updateContentMutation.mutate(values);
    else createContentMutation.mutate(values);
  };

  const isFolderMutating = createFolderMutation.isPending || updateFolderMutation.isPending;
  const isContentMutating = createContentMutation.isPending || updateContentMutation.isPending;

  // ─── Render: Folder Detail view ──────────────────────────────────────────

  if (openFolderId) {
    const folder = openFolder;
    return (
      <div className="space-y-6">
        {/* Breadcrumb header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setOpenFolderId(null)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-6 h-6 text-primary" />
                <h1 className="text-2xl font-bold">{folder?.name ?? '...'}</h1>
                {folder && (
                  <Badge variant={folder.status === 'published' ? 'default' : 'secondary'}>
                    {folder.status === 'published' ? 'Yayında' : 'Taslak'}
                  </Badge>
                )}
              </div>
              {folder?.description && <p className="text-muted-foreground text-sm mt-0.5">{folder.description}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => folder && openEditFolder(folder)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Klasörü Düzenle
            </Button>
            <Button onClick={openCreateContent}>
              <Plus className="w-4 h-4 mr-2" />
              İçerik Ekle
            </Button>
          </div>
        </div>

        {/* Contents table */}
        <Card>
          <CardContent className="p-0">
            {detailLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" /><span>Yükleniyor...</span>
              </div>
            ) : folderContents.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">Bu klasörde henüz içerik yok. "İçerik Ekle" ile başlayın.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>İçerik</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Boyut</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Güncelleme</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folderContents.map(item => {
                    const mt = getContentType(item);
                    const url = getContentUrl(item);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ContentIcon type={mt} className="w-7 h-7 text-primary opacity-70 shrink-0" />
                            <div>
                              <p className="font-medium text-sm">{item.displayName || item.title}</p>
                              {item.description && <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{item.description}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{MEDIA_TYPES.find(m => m.value === mt)?.label}</Badge></TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">{item.fileSize || '—'}</span></TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'published' ? 'default' : 'secondary'} className="flex items-center gap-1 w-fit">
                            {item.status === 'published' ? <><CheckCircle2 className="w-3 h-3" />Yayında</> : <><XCircle className="w-3 h-3" />Taslak</>}
                          </Badge>
                        </TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">{dayjs(item.updatedAt).format('DD.MM.YYYY')}</span></TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {url && <Button size="icon" variant="ghost" asChild title="Aç / İndir"><a href={url} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4" /></a></Button>}
                            <Button size="icon" variant="ghost" onClick={() => openEditContent(item)} title="Düzenle"><Edit2 className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteContent(item)} title="Sil"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Content dialog */}
        <ContentDialog
          open={contentDialogOpen}
          onOpenChange={setContentDialogOpen}
          form={contentForm}
          onSubmit={onContentSubmit}
          isMutating={isContentMutating}
          isEditing={!!editingContent}
          fileUploading={fileUploading}
          currentMediaEntry={currentMediaEntry}
          fileInputRef={fileInputRef}
          onFileSelect={(f) => handleFileUpload(f)}
        />

        {/* Delete content confirm */}
        <AlertDialog open={!!deleteContent} onOpenChange={o => !o && setDeleteContent(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>İçeriği Sil</AlertDialogTitle>
              <AlertDialogDescription>"{deleteContent?.displayName || deleteContent?.title}" kalıcı olarak silinecek.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteContent && deleteContentMutation.mutate(deleteContent.id)} className="bg-destructive text-destructive-foreground">Sil</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Folder edit dialog (reused) */}
        <FolderDialog
          open={folderDialogOpen}
          onOpenChange={setFolderDialogOpen}
          form={folderForm}
          onSubmit={onFolderSubmit}
          isMutating={isFolderMutating}
          isEditing={!!editingFolder}
          coverPreview={coverPreview}
          coverUploading={coverUploading}
          coverInputRef={coverInputRef}
          onCoverSelect={(f) => handleCoverUpload(f)}
        />
      </div>
    );
  }

  // ─── Render: Folder list view ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" />
            Partner Zone Yönetimi
          </h1>
          <p className="text-muted-foreground mt-1">
            Acentelerin göreceği klasörleri ve içerikleri yönetin.
          </p>
        </div>
        <Button onClick={openCreateFolder}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Klasör
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Klasör', value: folders.length },
          { label: 'Yayınlanan', value: folders.filter(f => f.status === 'published').length },
          { label: 'Taslak', value: folders.filter(f => f.status === 'draft').length },
          { label: 'Toplam İçerik', value: folders.reduce((s, f) => s + (f.contentCount ?? 0), 0) },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Folder grid */}
      {foldersLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /><span>Yükleniyor...</span>
        </div>
      ) : folders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Folder className="w-14 h-14 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">Henüz klasör yok. "Yeni Klasör" ile başlayın.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {folders.map(f => (
            <div key={f.id} className="group relative">
              {/* Folder card */}
              <div
                className="rounded-md border overflow-hidden cursor-pointer hover-elevate"
                onClick={() => setOpenFolderId(f.id)}
                data-testid={`folder-card-${f.id}`}
              >
                {/* Cover image */}
                <div className="relative aspect-square bg-muted flex items-center justify-center">
                  {f.coverImageUrl ? (
                    <img src={f.coverImageUrl} alt={f.name} className="w-full h-full object-cover" />
                  ) : (
                    <Folder className="w-16 h-16 text-muted-foreground opacity-30" />
                  )}
                  {/* Status badge overlay */}
                  <div className="absolute top-2 left-2">
                    <Badge variant={f.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                      {f.status === 'published' ? 'Yayında' : 'Taslak'}
                    </Badge>
                  </div>
                </div>
                {/* Name + count */}
                <div className="p-3">
                  <p className="font-semibold text-sm leading-tight line-clamp-2">{f.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{f.contentCount ?? 0} içerik</p>
                </div>
              </div>

              {/* Action buttons (visible on hover) */}
              <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); toggleFolderStatus.mutate(f); }}
                  title={f.status === 'published' ? 'Taslağa al' : 'Yayınla'}
                >
                  {f.status === 'published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); openEditFolder(f); }}
                  title="Düzenle"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); setDeleteFolder(f); }}
                  title="Sil"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Folder dialog */}
      <FolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        form={folderForm}
        onSubmit={onFolderSubmit}
        isMutating={isFolderMutating}
        isEditing={!!editingFolder}
        coverPreview={coverPreview}
        coverUploading={coverUploading}
        coverInputRef={coverInputRef}
        onCoverSelect={(f) => handleCoverUpload(f)}
      />

      {/* Delete folder confirm */}
      <AlertDialog open={!!deleteFolder} onOpenChange={o => !o && setDeleteFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Klasörü Sil</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteFolder?.name}" klasörü ve içindeki tüm içerikler kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteFolder && deleteFolderMutation.mutate(deleteFolder.id)} className="bg-destructive text-destructive-foreground">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Folder Dialog ──────────────────────────────────────────────────────────

interface Country { id: string; name: string; code: string; flag: string | null; status: string; }

function FolderDialog({ open, onOpenChange, form, onSubmit, isMutating, isEditing, coverPreview, coverUploading, coverInputRef, onCoverSelect }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: ReturnType<typeof useForm<FolderFormValues>>;
  onSubmit: (v: FolderFormValues) => void;
  isMutating: boolean;
  isEditing: boolean;
  coverPreview: string | null;
  coverUploading: boolean;
  coverInputRef: React.RefObject<HTMLInputElement>;
  onCoverSelect: (file: File) => void;
}) {
  const { data: countriesData } = useQuery<{ countries: Country[] }>({
    queryKey: ['/api/public/countries'],
    queryFn: async () => { const r = await fetch('/api/public/countries'); return r.json(); },
    staleTime: 5 * 60 * 1000,
  });
  const countryList = (countriesData?.countries ?? []).filter(c => c.status === 'active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Klasörü Düzenle' : 'Yeni Klasör'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Cover image */}
            <div className="space-y-2">
              <FormLabel>Kapak Görseli <span className="text-muted-foreground font-normal">(1080×1080 önerilen)</span></FormLabel>
              <div
                className="relative rounded-md border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer hover-elevate"
                style={{ aspectRatio: '1/1', maxHeight: 200 }}
                onClick={() => coverInputRef.current?.click()}
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                    <ImageIcon className="w-10 h-10 opacity-40" />
                    <span className="text-sm">Görsel yüklemek için tıklayın</span>
                  </div>
                )}
                {coverUploading && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <input
                ref={coverInputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={e => { const f = e.target.files?.[0]; if (f) onCoverSelect(f); e.target.value = ''; }}
              />
            </div>

            {/* Name */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Klasör Adı</FormLabel>
                <FormControl><Input {...field} placeholder="ör. Pathway Flyers" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Açıklama <span className="text-muted-foreground font-normal">(opsiyonel)</span></FormLabel>
                <FormControl><Textarea {...field} value={field.value ?? ''} rows={2} placeholder="Klasör hakkında kısa açıklama..." /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Category + Country */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="categoryTag" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} placeholder="ör. Flyers" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="countryCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ülke</FormLabel>
                  <Select
                    onValueChange={v => field.onChange(v === '__none__' ? '' : v)}
                    value={field.value || '__none__'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Ülke seçin..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60">
                      <SelectItem value="__none__">— Ülke yok —</SelectItem>
                      {countryList.map(c => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.flag ? `${c.flag} ` : ''}{c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Order + Status */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="order" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sıralama</FormLabel>
                  <FormControl><Input {...field} type="number" min={0} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Durum</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Taslak</SelectItem>
                      <SelectItem value="published">Yayınla</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Kaydediliyor...</> : 'Kaydet'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Content Dialog ─────────────────────────────────────────────────────────

function ContentDialog({ open, onOpenChange, form, onSubmit, isMutating, isEditing, fileUploading, currentMediaEntry, fileInputRef, onFileSelect }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: ReturnType<typeof useForm<ContentFormValues>>;
  onSubmit: (v: ContentFormValues) => void;
  isMutating: boolean;
  isEditing: boolean;
  fileUploading: boolean;
  currentMediaEntry: typeof MEDIA_TYPES[0];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (file: File) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'İçeriği Düzenle' : 'İçerik Ekle'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Media type */}
            <FormField control={form.control} name="mediaType" render={({ field }) => (
              <FormItem>
                <FormLabel>İçerik Türü</FormLabel>
                <div className="grid grid-cols-3 gap-2">
                  {MEDIA_TYPES.map(mt => {
                    const Icon = mt.icon;
                    const active = field.value === mt.value;
                    return (
                      <button key={mt.value} type="button"
                        onClick={() => { field.onChange(mt.value); form.setValue('fileUrl', ''); form.setValue('fileSize', ''); }}
                        className={`flex flex-col items-center gap-1.5 rounded-md border py-3 px-2 text-sm font-medium transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover-elevate'}`}
                      >
                        <Icon className="w-5 h-5" />{mt.label}
                      </button>
                    );
                  })}
                </div>
              </FormItem>
            )} />

            {/* Title */}
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Başlık</FormLabel>
                <FormControl><Input {...field} placeholder={`${currentMediaEntry.label} başlığı`} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Display Name */}
            <FormField control={form.control} name="displayName" render={({ field }) => (
              <FormItem>
                <FormLabel>Görüntülenen Ad <span className="text-muted-foreground font-normal">(opsiyonel)</span></FormLabel>
                <FormControl><Input {...field} placeholder="İndirme butonunda görünecek ad" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Açıklama</FormLabel>
                <FormControl><Textarea {...field} value={field.value ?? ''} rows={2} placeholder="Kısa açıklama..." /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Upload */}
            <div className="space-y-2">
              <FormLabel>Dosya Yükle</FormLabel>
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={fileUploading} className="w-full">
                {fileUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Yükleniyor...</> : <><Upload className="w-4 h-4 mr-2" />{currentMediaEntry.label} Yükle</>}
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" accept={currentMediaEntry.accept}
                onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ''; }} />
            </div>

            {/* URL */}
            <FormField control={form.control} name="fileUrl" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1"><Link2 className="w-3 h-3" />URL <span className="text-muted-foreground font-normal">(veya manuel gir)</span></FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} placeholder="https://..." /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* File size */}
            <FormField control={form.control} name="fileSize" render={({ field }) => (
              <FormItem>
                <FormLabel>Dosya Boyutu <span className="text-muted-foreground font-normal">(opsiyonel)</span></FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} placeholder="ör. 2.3 MB" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Status */}
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Durum</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="draft">Taslak</SelectItem>
                    <SelectItem value="published">Yayınla</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Kaydediliyor...</> : 'Kaydet'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
