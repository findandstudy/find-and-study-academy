import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Package, Plus, Edit2, Trash2, Search, Download, Upload,
  FileText, Globe, Tag, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Link2
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
  displayName: string | null;
  fileSize: string | null;
  updatedAt: string;
  createdAt: string;
}

const formSchema = z.object({
  title: z.string().min(1, 'Başlık zorunlu'),
  description: z.string().optional(),
  categoryTag: z.string().optional(),
  countryCode: z.string().optional(),
  displayName: z.string().optional(),
  fileSize: z.string().optional(),
  documentUrl: z.string().optional(),
  status: z.enum(['draft', 'published']),
});

type FormValues = z.infer<typeof formSchema>;

export default function PartnerZoneAdmin() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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

  const allDocs = (data?.contents ?? []).filter(
    c => c.type === 'document' || c.contentType === 'document'
  );

  const categories = Array.from(new Set(allDocs.map(d => d.categoryTag).filter(Boolean))) as string[];

  const filtered = allDocs.filter(doc => {
    const matchesSearch = !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      (doc.displayName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (doc.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.categoryTag === categoryFilter;
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      categoryTag: '',
      countryCode: '',
      displayName: '',
      fileSize: '',
      documentUrl: '',
      status: 'draft',
    },
  });

  const openCreate = () => {
    setEditingDoc(null);
    form.reset({
      title: '', description: '', categoryTag: '', countryCode: '',
      displayName: '', fileSize: '', documentUrl: '', status: 'draft',
    });
    setDialogOpen(true);
  };

  const openEdit = (doc: PartnerDoc) => {
    setEditingDoc(doc);
    form.reset({
      title: doc.title,
      description: doc.description ?? '',
      categoryTag: doc.categoryTag ?? '',
      countryCode: doc.countryCode ?? '',
      displayName: doc.displayName ?? '',
      fileSize: doc.fileSize ?? '',
      documentUrl: doc.documentUrl ?? '',
      status: (doc.status as 'draft' | 'published') ?? 'draft',
    });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        type: 'document',
        contentType: 'document',
        slug: `partner-${Date.now()}`,
        language: 'tr',
        order: 0,
      };
      const res = await apiRequest('POST', '/api/admin/contents', payload);
      if (!res.ok) throw new Error('Oluşturulamadı');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      toast({ title: 'Oluşturuldu', description: 'Belge Partner Zone\'a eklendi.' });
      setDialogOpen(false);
    },
    onError: () => toast({ title: 'Hata', description: 'Belge oluşturulamadı.', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!editingDoc) return;
      const res = await apiRequest('PATCH', `/api/admin/contents/${editingDoc.id}`, values);
      if (!res.ok) throw new Error('Güncellenemedi');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      toast({ title: 'Güncellendi', description: 'Belge bilgileri kaydedildi.' });
      setDialogOpen(false);
    },
    onError: () => toast({ title: 'Hata', description: 'Belge güncellenemedi.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/admin/contents/${id}`);
      if (!res.ok) throw new Error('Silinemedi');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      toast({ title: 'Silindi', description: 'Belge Partner Zone\'dan kaldırıldı.' });
      setDeleteDoc(null);
    },
    onError: () => toast({ title: 'Hata', description: 'Belge silinemedi.', variant: 'destructive' }),
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
      formData.append('folder', 'documents');
      const res = await fetch('/api/uploads/content', {
        method: 'POST',
        headers: {
          'x-user-id': user?.id ?? '',
          'x-user-role': user?.role ?? '',
        },
        body: formData,
      });
      if (!res.ok) throw new Error('Yükleme başarısız');
      const data = await res.json();
      if (data.url) {
        form.setValue('documentUrl', data.url);
        form.setValue('displayName', data.originalName ?? file.name);
        const sizeKB = file.size / 1024;
        form.setValue('fileSize', sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`);
        toast({ title: 'Dosya yüklendi', description: data.originalName ?? file.name });
      }
    } catch {
      toast({ title: 'Yükleme Hatası', description: 'Dosya yüklenemedi.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (values: FormValues) => {
    if (editingDoc) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

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
            Acente tarafında görünen indirilebilir doküman ve kaynakları yönetin.
          </p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-partner-doc">
          <Plus className="w-4 h-4 mr-2" />
          Yeni Belge Ekle
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Belge', value: allDocs.length, color: 'text-foreground' },
          { label: 'Yayınlanan', value: allDocs.filter(d => d.status === 'published').length, color: 'text-green-600 dark:text-green-400' },
          { label: 'Taslak', value: allDocs.filter(d => d.status === 'draft').length, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Kategori', value: categories.length, color: 'text-primary' },
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
            placeholder="Belge ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-partner"
          />
        </div>
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
                {allDocs.length === 0 ? 'Henüz Partner Zone belgesi yok. "Yeni Belge Ekle" ile başlayın.' : 'Aramanızla eşleşen belge bulunamadı.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Belge</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Ülke</TableHead>
                  <TableHead>Boyut</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Güncelleme</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(doc => (
                  <TableRow key={doc.id} data-testid={`row-partner-doc-${doc.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-primary shrink-0 opacity-70" />
                        <div>
                          <p className="font-medium text-sm">{doc.displayName || doc.title}</p>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">{doc.description}</p>
                          )}
                        </div>
                      </div>
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
                        {/* Toggle publish */}
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
                        {/* Download */}
                        {doc.documentUrl && (
                          <Button
                            size="icon"
                            variant="ghost"
                            asChild
                            title="İndir"
                          >
                            <a href={doc.documentUrl} download target="_blank" rel="noopener noreferrer">
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        {/* Edit */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(doc)}
                          title="Düzenle"
                          data-testid={`button-edit-partner-doc-${doc.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {/* Delete */}
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDoc ? 'Belgeyi Düzenle' : 'Yeni Belge Ekle'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Title */}
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Başlık</FormLabel>
                  <FormControl><Input {...field} placeholder="Belge başlığı" data-testid="input-doc-title" /></FormControl>
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
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ''} placeholder="Belge hakkında kısa açıklama..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Category + Country */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="categoryTag" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} placeholder="ör. Kılavuzlar" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="countryCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ülke Kodu</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} placeholder="ör. TR" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* File Upload OR URL */}
              <div className="space-y-2">
                <FormLabel>Dosya</FormLabel>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    {uploading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Yükleniyor...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Dosya Yükle</>
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.zip,.mp4"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                  />
                </div>
              </div>

              {/* Document URL (manual) */}
              <FormField control={form.control} name="documentUrl" render={({ field }) => (
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
                  <FormControl><Input {...field} value={field.value ?? ''} placeholder="ör. 2.3 MB" /></FormControl>
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
                  {isMutating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Kaydediliyor...</> : 'Kaydet'}
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
            <AlertDialogTitle>Belgeyi Sil</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDoc?.displayName || deleteDoc?.title}" belgesi Partner Zone'dan kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDoc && deleteMutation.mutate(deleteDoc.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
