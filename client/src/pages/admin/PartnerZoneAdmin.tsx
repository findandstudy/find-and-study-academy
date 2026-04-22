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
  Package, Plus, Edit2, Trash2, Search, Download, Upload,
  FileText, Globe, Tag, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Link2,
  Video, Image, File
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import dayjs from 'dayjs';

interface PartnerDoc {
  id: string;
  title: string;
  description: string | null;
  contentType: string | null;
  type: string;
  status: string;
  countryCode: string | null;
  categoryTag: string | null;
  documentUrl: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  displayName: string | null;
  fileSize: string | null;
  updatedAt: string;
  createdAt: string;
}

type MediaType = 'document' | 'video' | 'image';

const MEDIA_TYPES: { value: MediaType; label: string; icon: React.ElementType; accept: string; folder: string }[] = [
  { value: 'document', label: 'Belge', icon: FileText, accept: '.pdf,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.zip', folder: 'documents' },
  { value: 'video',    label: 'Video',  icon: Video,    accept: '.mp4,.mov,.webm,.avi,.mkv',                  folder: 'videos'    },
  { value: 'image',    label: 'Görsel', icon: Image,    accept: '.jpg,.jpeg,.png,.gif,.webp,.svg',             folder: 'images'    },
];

const formSchema = z.object({
  mediaType: z.enum(['document', 'video', 'image']),
  title: z.string().min(1, 'Başlık zorunlu'),
  description: z.string().optional(),
  categoryTag: z.string().optional(),
  countryCode: z.string().optional(),
  displayName: z.string().optional(),
  fileSize: z.string().optional(),
  fileUrl: z.string().optional(),
  status: z.enum(['draft', 'published']),
});

type FormValues = z.infer<typeof formSchema>;

function getDocUrl(doc: PartnerDoc): string | null {
  return doc.documentUrl ?? doc.videoUrl ?? doc.imageUrl ?? null;
}

function getDocMediaType(doc: PartnerDoc): MediaType {
  if (doc.contentType === 'video' || doc.type === 'video') return 'video';
  if (doc.contentType === 'image' || doc.type === 'image') return 'image';
  return 'document';
}

function MediaTypeIcon({ type, className }: { type: MediaType; className?: string }) {
  const entry = MEDIA_TYPES.find(m => m.value === type);
  const Icon = entry?.icon ?? File;
  return <Icon className={className} />;
}

export default function PartnerZoneAdmin() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<PartnerDoc | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<PartnerDoc | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<{ success: boolean; contents: PartnerDoc[] }>({
    queryKey: ['/api/admin/contents'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/contents');
      return res.json();
    },
  });

  // Include document, video, image types
  const allDocs = (data?.contents ?? []).filter(c =>
    ['document', 'video', 'image'].includes(c.type) ||
    ['document', 'video', 'image'].includes(c.contentType ?? '')
  );

  const categories = Array.from(new Set(allDocs.map(d => d.categoryTag).filter(Boolean))) as string[];

  const filtered = allDocs.filter(doc => {
    const matchesSearch = !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      (doc.displayName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (doc.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.categoryTag === categoryFilter;
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesType = typeFilter === 'all' || getDocMediaType(doc) === typeFilter;
    return matchesSearch && matchesCategory && matchesStatus && matchesType;
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mediaType: 'document',
      title: '',
      description: '',
      categoryTag: '',
      countryCode: '',
      displayName: '',
      fileSize: '',
      fileUrl: '',
      status: 'draft',
    },
  });

  const watchedMediaType = form.watch('mediaType');
  const currentMediaEntry = MEDIA_TYPES.find(m => m.value === watchedMediaType) ?? MEDIA_TYPES[0];

  const openCreate = () => {
    setEditingDoc(null);
    form.reset({
      mediaType: 'document',
      title: '', description: '', categoryTag: '', countryCode: '',
      displayName: '', fileSize: '', fileUrl: '', status: 'draft',
    });
    setDialogOpen(true);
  };

  const openEdit = (doc: PartnerDoc) => {
    setEditingDoc(doc);
    form.reset({
      mediaType: getDocMediaType(doc),
      title: doc.title,
      description: doc.description ?? '',
      categoryTag: doc.categoryTag ?? '',
      countryCode: doc.countryCode ?? '',
      displayName: doc.displayName ?? '',
      fileSize: doc.fileSize ?? '',
      fileUrl: getDocUrl(doc) ?? '',
      status: (doc.status as 'draft' | 'published') ?? 'draft',
    });
    setDialogOpen(true);
  };

  const buildPayload = (values: FormValues) => {
    const base = {
      title: values.title,
      description: values.description,
      categoryTag: values.categoryTag,
      countryCode: values.countryCode,
      displayName: values.displayName,
      fileSize: values.fileSize,
      status: values.status,
      type: values.mediaType,
      contentType: values.mediaType,
      language: 'tr',
      order: 0,
    };
    if (values.mediaType === 'video')    return { ...base, videoUrl: values.fileUrl,    documentUrl: null, imageUrl: null };
    if (values.mediaType === 'image')    return { ...base, imageUrl: values.fileUrl,    documentUrl: null, videoUrl: null };
    return { ...base, documentUrl: values.fileUrl, videoUrl: null, imageUrl: null };
  };

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...buildPayload(values), slug: `partner-${Date.now()}` };
      const res = await apiRequest('POST', '/api/admin/contents', payload);
      if (!res.ok) throw new Error('Oluşturulamadı');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      toast({ title: 'Oluşturuldu', description: 'İçerik Partner Zone\'a eklendi.' });
      setDialogOpen(false);
    },
    onError: () => toast({ title: 'Hata', description: 'İçerik oluşturulamadı.', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!editingDoc) return;
      const res = await apiRequest('PATCH', `/api/admin/contents/${editingDoc.id}`, buildPayload(values));
      if (!res.ok) throw new Error('Güncellenemedi');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      toast({ title: 'Güncellendi', description: 'İçerik bilgileri kaydedildi.' });
      setDialogOpen(false);
    },
    onError: () => toast({ title: 'Hata', description: 'İçerik güncellenemedi.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/admin/contents/${id}`);
      if (!res.ok) throw new Error('Silinemedi');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      toast({ title: 'Silindi', description: 'İçerik Partner Zone\'dan kaldırıldı.' });
      setDeleteDoc(null);
    },
    onError: () => toast({ title: 'Hata', description: 'İçerik silinemedi.', variant: 'destructive' }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (doc: PartnerDoc) => {
      const newStatus = doc.status === 'published' ? 'draft' : 'published';
      const res = await apiRequest('PATCH', `/api/admin/contents/${doc.id}`, { status: newStatus });
      if (!res.ok) throw new Error('Durum değiştirilemedi');
      return { doc, newStatus };
    },
    onSuccess: ({ doc, newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      toast({
        title: newStatus === 'published' ? 'Yayınlandı' : 'Taslağa alındı',
        description: `"${doc.title}" ${newStatus === 'published' ? 'yayınlandı' : 'taslağa alındı'}.`,
      });
    },
    onError: () => toast({ title: 'Hata', description: 'Durum değiştirilemedi.', variant: 'destructive' }),
  });

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', currentMediaEntry.folder);
      const res = await fetch('/api/uploads/content', {
        method: 'POST',
        headers: { 'x-user-id': user?.id ?? '', 'x-user-role': user?.role ?? '' },
        body: formData,
      });
      if (!res.ok) throw new Error('Yükleme başarısız');
      const result = await res.json();
      if (result.url) {
        form.setValue('fileUrl', result.url);
        form.setValue('displayName', result.originalName ?? file.name);
        const sizeKB = file.size / 1024;
        form.setValue('fileSize', sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`);
        toast({ title: 'Dosya yüklendi', description: result.originalName ?? file.name });
      }
    } catch {
      toast({ title: 'Yükleme Hatası', description: 'Dosya yüklenemedi.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (values: FormValues) => {
    if (editingDoc) updateMutation.mutate(values);
    else createMutation.mutate(values);
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const mediaTypeLabel: Record<MediaType, string> = { document: 'Belge', video: 'Video', image: 'Görsel' };

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
            Acente tarafında görünen indirilebilir doküman, video ve görsel kaynaklarını yönetin.
          </p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-partner-doc">
          <Plus className="w-4 h-4 mr-2" />
          Yeni İçerik Ekle
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Toplam İçerik', value: allDocs.length, color: 'text-foreground' },
          { label: 'Belge', value: allDocs.filter(d => getDocMediaType(d) === 'document').length, color: 'text-primary' },
          { label: 'Video', value: allDocs.filter(d => getDocMediaType(d) === 'video').length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Görsel', value: allDocs.filter(d => getDocMediaType(d) === 'image').length, color: 'text-green-600 dark:text-green-400' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="İçerik ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-partner"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" data-testid="select-type">
            <SelectValue placeholder="Tüm Türler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Türler</SelectItem>
            <SelectItem value="document">Belge</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="image">Görsel</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48" data-testid="select-category">
            <SelectValue placeholder="Tüm Kategoriler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Kategoriler</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status">
            <SelectValue placeholder="Tüm Durumlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="published">Yayınlanan</SelectItem>
            <SelectItem value="draft">Taslak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Yükleniyor...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">
                {allDocs.length === 0
                  ? 'Henüz Partner Zone içeriği yok. "Yeni İçerik Ekle" ile başlayın.'
                  : 'Aramanızla eşleşen içerik bulunamadı.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İçerik</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Ülke</TableHead>
                  <TableHead>Boyut</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Güncelleme</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(doc => {
                  const mt = getDocMediaType(doc);
                  const url = getDocUrl(doc);
                  return (
                    <TableRow key={doc.id} data-testid={`row-partner-doc-${doc.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <MediaTypeIcon type={mt} className="w-8 h-8 text-primary shrink-0 opacity-70" />
                          <div>
                            <p className="font-medium text-sm">{doc.displayName || doc.title}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[220px]">{doc.description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {mediaTypeLabel[mt]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {doc.categoryTag ? (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <Tag className="w-3 h-3" />
                            {doc.categoryTag}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {doc.countryCode ? (
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <Globe className="w-3 h-3" />
                            {doc.countryCode}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{doc.fileSize || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={doc.status === 'published' ? 'default' : 'secondary'}
                          className="flex items-center gap-1 w-fit"
                        >
                          {doc.status === 'published' ? (
                            <><CheckCircle2 className="w-3 h-3" />Yayında</>
                          ) : (
                            <><XCircle className="w-3 h-3" />Taslak</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {dayjs(doc.updatedAt).format('DD.MM.YYYY')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleStatusMutation.mutate(doc)}
                            disabled={toggleStatusMutation.isPending}
                            title={doc.status === 'published' ? 'Taslağa al' : 'Yayınla'}
                            data-testid={`button-toggle-status-${doc.id}`}
                          >
                            {doc.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          {url && (
                            <Button size="icon" variant="ghost" asChild title="Aç / İndir">
                              <a href={url} download target="_blank" rel="noopener noreferrer">
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(doc)}
                            title="Düzenle"
                            data-testid={`button-edit-partner-doc-${doc.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteDoc(doc)}
                            title="Sil"
                            data-testid={`button-delete-partner-doc-${doc.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDoc ? 'İçeriği Düzenle' : 'Yeni İçerik Ekle'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Media Type selector */}
              <FormField control={form.control} name="mediaType" render={({ field }) => (
                <FormItem>
                  <FormLabel>İçerik Türü</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {MEDIA_TYPES.map(mt => {
                      const Icon = mt.icon;
                      const active = field.value === mt.value;
                      return (
                        <button
                          key={mt.value}
                          type="button"
                          onClick={() => {
                            field.onChange(mt.value);
                            form.setValue('fileUrl', '');
                            form.setValue('fileSize', '');
                          }}
                          className={`flex flex-col items-center gap-1.5 rounded-md border py-3 px-2 text-sm font-medium transition-colors
                            ${active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover-elevate'
                            }`}
                        >
                          <Icon className="w-5 h-5" />
                          {mt.label}
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Title */}
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Başlık</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={`${currentMediaEntry.label} başlığı`} data-testid="input-doc-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Display Name */}
              <FormField control={form.control} name="displayName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Görüntülenen Ad <span className="text-muted-foreground font-normal">(opsiyonel)</span></FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="İndirme / önizleme butonunda görünecek ad" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Description */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ''} placeholder={`${currentMediaEntry.label} hakkında kısa açıklama...`} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Category + Country */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="categoryTag" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="ör. Kılavuzlar" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="countryCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ülke Kodu</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="ör. TR" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <FormLabel>Dosya Yükle</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Yükleniyor...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" />{currentMediaEntry.label} Yükle</>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={currentMediaEntry.accept}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }}
                />
              </div>

              {/* File URL (manual) */}
              <FormField control={form.control} name="fileUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Dosya URL <span className="text-muted-foreground font-normal">(veya manuel gir)</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} placeholder="https://..." data-testid="input-doc-url" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* File Size */}
              <FormField control={form.control} name="fileSize" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dosya Boyutu <span className="text-muted-foreground font-normal">(opsiyonel)</span></FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} placeholder="ör. 2.3 MB" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Status */}
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Durum</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-doc-status">
                        <SelectValue placeholder="Durum seçin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Taslak</SelectItem>
                      <SelectItem value="published">Yayınla</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
                <Button type="submit" disabled={isMutating} data-testid="button-save-partner-doc">
                  {isMutating
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Kaydediliyor...</>
                    : 'Kaydet'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteDoc} onOpenChange={open => !open && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İçeriği Sil</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDoc?.displayName || deleteDoc?.title}" Partner Zone'dan kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDoc && deleteMutation.mutate(deleteDoc.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
