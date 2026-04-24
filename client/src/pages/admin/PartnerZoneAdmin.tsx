import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Package, Plus, Edit2, Trash2, Upload, Folder, FolderOpen,
  FileText, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  Video, Image as ImageIcon, File, Link2, Download,
  ChevronRight, Home, Search, ExternalLink,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import { CountryFlag } from '@/components/CountryFlag';
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
  parentFolderId: string | null;
  subfolderCount?: number;
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

interface CountryItem {
  id: string;
  name: string;
  code: string;
  flag: string | null;
  status: string;
}

type MediaType = 'document' | 'video' | 'image';
type FileTypeFilter = 'all' | MediaType;
type SortKey = 'newest' | 'oldest' | 'az' | 'za';

const MEDIA_TYPES: { value: MediaType; label: string; icon: React.ElementType; accept: string; folder: string }[] = [
  { value: 'document', label: 'Belge', icon: FileText, accept: '.pdf,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.zip', folder: 'documents' },
  { value: 'video',    label: 'Video', icon: Video,    accept: '.mp4,.mov,.webm,.avi,.mkv',                  folder: 'videos'    },
  { value: 'image',    label: 'Görsel', icon: ImageIcon, accept: '.jpg,.jpeg,.png,.gif,.webp,.svg',           folder: 'images'    },
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
  const Icon = MEDIA_TYPES.find((m) => m.value === type)?.icon ?? File;
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

// ─── Toolbar (shared between list + detail) ────────────────────────────────

interface ToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  country: string;
  onCountryChange: (v: string) => void;
  countries: CountryItem[];
  showFileType?: boolean;
  fileType?: FileTypeFilter;
  onFileTypeChange?: (v: FileTypeFilter) => void;
  sort: SortKey;
  onSortChange: (v: SortKey) => void;
}

function PartnerToolbar(props: ToolbarProps) {
  // Local input state debounced (250ms) before propagating to parent filter state
  const [localSearch, setLocalSearch] = useState(props.search);
  useEffect(() => { setLocalSearch(props.search); }, [props.search]);
  useEffect(() => {
    if (localSearch === props.search) return;
    const t = setTimeout(() => props.onSearchChange(localSearch), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Ara..."
          className="pl-9"
          data-testid="input-admin-partner-search"
        />
      </div>
      <Select value={props.country} onValueChange={props.onCountryChange}>
        <SelectTrigger className="w-full sm:w-44" data-testid="select-admin-partner-country">
          <SelectValue placeholder="Ülke" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="all">Tüm ülkeler</SelectItem>
          {props.countries.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {props.showFileType && props.onFileTypeChange && (
        <Select value={props.fileType ?? 'all'} onValueChange={(v) => props.onFileTypeChange?.(v as FileTypeFilter)}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-admin-partner-filetype">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm türler</SelectItem>
            <SelectItem value="document">Belge</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="image">Görsel</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Select value={props.sort} onValueChange={(v) => props.onSortChange(v as SortKey)}>
        <SelectTrigger className="w-full sm:w-40" data-testid="select-admin-partner-sort">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Yeni → Eski</SelectItem>
          <SelectItem value="oldest">Eski → Yeni</SelectItem>
          <SelectItem value="az">A → Z</SelectItem>
          <SelectItem value="za">Z → A</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Sorting helpers ───────────────────────────────────────────────────────

function sortFolders(list: PartnerFolder[], sort: SortKey): PartnerFolder[] {
  const arr = [...list];
  arr.sort((a, b) => {
    if (sort === 'az') return a.name.localeCompare(b.name, 'tr');
    if (sort === 'za') return b.name.localeCompare(a.name, 'tr');
    const da = new Date(a.createdAt ?? 0).getTime();
    const db = new Date(b.createdAt ?? 0).getTime();
    return sort === 'newest' ? db - da : da - db;
  });
  return arr;
}

function sortContents(list: FolderContent[], sort: SortKey): FolderContent[] {
  const arr = [...list];
  arr.sort((a, b) => {
    if (sort === 'az') return (a.displayName ?? a.title).localeCompare(b.displayName ?? b.title, 'tr');
    if (sort === 'za') return (b.displayName ?? b.title).localeCompare(a.displayName ?? a.title, 'tr');
    const da = new Date(a.updatedAt).getTime();
    const db = new Date(b.updatedAt).getTime();
    return sort === 'newest' ? db - da : da - db;
  });
  return arr;
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function PartnerZoneAdmin() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [, params] = useRoute('/admin/partner-zone/:folderId');
  const [, navigate] = useLocation();
  const folderId = params?.folderId ?? null;

  // Toolbar state
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('all');
  const [fileType, setFileType] = useState<FileTypeFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');

  // Folder CRUD state
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<PartnerFolder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<PartnerFolder | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  // Pending uploaded cover URL kept in component state instead of window globals
  const [pendingCoverUrl, setPendingCoverUrl] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Content CRUD state (inside a folder)
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<FolderContent | null>(null);
  const [deleteContent, setDeleteContent] = useState<FolderContent | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ────────────────────────────────────────────────────────────

  const listParentParam = folderId ?? 'root';

  const { data: foldersData, isLoading: foldersLoading } = useQuery<{ folders: PartnerFolder[] }>({
    queryKey: ['/api/admin/partner-folders', { parentId: listParentParam }],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/admin/partner-folders?parentId=${encodeURIComponent(listParentParam)}`);
      return r.json();
    },
    enabled: !folderId,
  });

  const { data: folderDetailData, isLoading: detailLoading } = useQuery<{
    folder: PartnerFolder;
    contents: FolderContent[];
    subfolders: PartnerFolder[];
    breadcrumb: PartnerFolder[];
  }>({
    queryKey: ['/api/admin/partner-folders', folderId],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/admin/partner-folders/${folderId}`);
      return r.json();
    },
    enabled: !!folderId,
  });

  const { data: countriesData } = useQuery<{ countries: CountryItem[] }>({
    queryKey: ['/api/public/countries'],
    queryFn: async () => {
      const r = await fetch('/api/public/countries');
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const countries = (countriesData?.countries ?? []).filter((c) => c.status === 'active');

  const rootFolders = foldersData?.folders ?? [];
  const openFolder = folderDetailData?.folder ?? null;
  const folderContents = folderDetailData?.contents ?? [];
  const folderSubfolders = folderDetailData?.subfolders ?? [];
  const breadcrumb = folderDetailData?.breadcrumb ?? [];

  // ─── Filtering / sorting ───────────────────────────────────────────────

  const filteredRootFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortFolders(
      rootFolders.filter((f) => {
        if (country !== 'all' && f.countryCode !== country) return false;
        if (q) {
          const hay = `${f.name} ${f.description ?? ''} ${f.categoryTag ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
      sort,
    );
  }, [rootFolders, country, search, sort]);

  const filteredSubfolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortFolders(
      folderSubfolders.filter((f) => {
        if (country !== 'all' && f.countryCode !== country) return false;
        if (q) {
          const hay = `${f.name} ${f.description ?? ''} ${f.categoryTag ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
      sort,
    );
  }, [folderSubfolders, country, search, sort]);

  const filteredFolderContents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortContents(
      folderContents.filter((c) => {
        if (fileType !== 'all' && getContentType(c) !== fileType) return false;
        if (q) {
          const hay = `${c.title} ${c.description ?? ''} ${c.displayName ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
      sort,
    );
  }, [folderContents, fileType, search, sort]);

  // ─── Folder form ─────────────────────────────────────────────────────────

  const folderForm = useForm<FolderFormValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: { name: '', description: '', categoryTag: '', countryCode: '', order: 0, status: 'draft' },
  });

  const openCreateFolder = () => {
    setEditingFolder(null);
    setCoverPreview(null);
    setPendingCoverUrl(null);
    folderForm.reset({
      name: '',
      description: '',
      categoryTag: '',
      countryCode: '',
      order: (folderId ? folderSubfolders.length : rootFolders.length),
      status: 'draft',
    });
    setFolderDialogOpen(true);
  };

  const openEditFolder = (f: PartnerFolder) => {
    setEditingFolder(f);
    setCoverPreview(f.coverImageUrl);
    setPendingCoverUrl(null);
    folderForm.reset({
      name: f.name,
      description: f.description ?? '',
      categoryTag: f.categoryTag ?? '',
      countryCode: f.countryCode ?? '',
      order: f.order,
      status: f.status as 'draft' | 'published',
    });
    setFolderDialogOpen(true);
  };

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'images');
      // Server will downsize images to 540x540 when purpose=cover
      fd.append('purpose', 'cover');
      const res = await fetch('/api/uploads/content', {
        method: 'POST',
        headers: { 'x-user-id': user?.id ?? '', 'x-user-role': user?.role ?? '' },
        body: fd,
      });
      if (!res.ok) throw new Error();
      const data: { url?: string } = await res.json();
      if (data.url) {
        setCoverPreview(data.url);
        setPendingCoverUrl(data.url);
        toast({ title: 'Kapak yüklendi', description: '540×540 boyutuna küçültüldü.' });
      }
    } catch {
      toast({ title: 'Yükleme hatası', variant: 'destructive' });
    } finally {
      setCoverUploading(false);
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: async (values: FolderFormValues) => {
      const payload = {
        ...values,
        coverImageUrl: pendingCoverUrl,
        // Nest under the folder we're currently inside; null at root
        parentFolderId: folderId ?? null,
      };
      const r = await apiRequest('POST', '/api/admin/partner-folders', payload);
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders'] });
      toast({ title: 'Klasör oluşturuldu' });
      setFolderDialogOpen(false);
      setPendingCoverUrl(null);
    },
    onError: () => toast({ title: 'Hata', description: 'Klasör oluşturulamadı', variant: 'destructive' }),
  });

  const updateFolderMutation = useMutation({
    mutationFn: async (values: FolderFormValues) => {
      if (!editingFolder) return;
      const payload: Partial<PartnerFolder> & FolderFormValues = { ...values };
      if (pendingCoverUrl) payload.coverImageUrl = pendingCoverUrl;
      const r = await apiRequest('PATCH', `/api/admin/partner-folders/${editingFolder.id}`, payload);
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders'] });
      toast({ title: 'Klasör güncellendi' });
      setFolderDialogOpen(false);
      setPendingCoverUrl(null);
    },
    onError: () => toast({ title: 'Hata', description: 'Güncellenemedi', variant: 'destructive' }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest('DELETE', `/api/admin/partner-folders/${id}`);
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        const message = body?.message ?? 'Silme işlemi başarısız';
        throw new Error(message);
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders'] });
      toast({ title: 'Klasör silindi' });
      setDeleteFolder(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Silinemedi', description: err.message, variant: 'destructive' });
    },
  });

  const toggleFolderStatus = useMutation({
    mutationFn: async (f: PartnerFolder) => {
      const r = await apiRequest('PATCH', `/api/admin/partner-folders/${f.id}`, {
        status: f.status === 'published' ? 'draft' : 'published',
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders'] });
    },
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
  const currentMediaEntry = MEDIA_TYPES.find((m) => m.value === watchedMediaType) ?? MEDIA_TYPES[0];

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
      const data: { url?: string; originalName?: string } = await res.json();
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
      title: values.title,
      description: values.description,
      displayName: values.displayName,
      fileSize: values.fileSize,
      status: values.status,
      type: values.mediaType,
      contentType: values.mediaType,
      language: 'tr',
      order: 0,
      folderId,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', folderId] });
      toast({ title: 'İçerik eklendi' });
      setContentDialogOpen(false);
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', folderId] });
      toast({ title: 'İçerik güncellendi' });
      setContentDialogOpen(false);
    },
    onError: () => toast({ title: 'Hata', variant: 'destructive' }),
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest('DELETE', `/api/admin/contents/${id}`);
      if (!r.ok) throw new Error();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', folderId] });
      toast({ title: 'İçerik silindi' });
      setDeleteContent(null);
    },
    onError: () => toast({ title: 'Hata', variant: 'destructive' }),
  });

  const onContentSubmit = (values: ContentFormValues) => {
    if (editingContent) updateContentMutation.mutate(values);
    else createContentMutation.mutate(values);
  };

  const isFolderMutating = createFolderMutation.isPending || updateFolderMutation.isPending;
  const isContentMutating = createContentMutation.isPending || updateContentMutation.isPending;

  // ─── Folder card (admin variant with overlay actions) ─────────────────────
  const renderFolderCard = (f: PartnerFolder) => {
    const country = countries.find((c) => c.code === f.countryCode) ?? null;
    return (
      <div key={f.id} className="group relative">
        <div
          className="rounded-md border overflow-hidden cursor-pointer hover-elevate"
          onClick={() => navigate(`/admin/partner-zone/${f.id}`)}
          data-testid={`folder-card-${f.id}`}
        >
          <div className="relative aspect-square bg-muted flex items-center justify-center">
            {f.coverImageUrl ? (
              <img src={f.coverImageUrl} alt={f.name} className="w-full h-full object-cover" />
            ) : (
              <Folder className="w-16 h-16 text-muted-foreground opacity-30" />
            )}
            <div className="absolute top-2 left-2">
              <Badge variant={f.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                {f.status === 'published' ? 'Yayında' : 'Taslak'}
              </Badge>
            </div>
          </div>
          <div className="p-3 space-y-1">
            <p className="font-semibold text-sm leading-tight line-clamp-2">{f.name}</p>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              {country ? (
                <span className="inline-flex items-center gap-1.5 truncate">
                  <CountryFlag code={country.code} size="sm" />
                  <span className="truncate">{country.name}</span>
                </span>
              ) : (
                <span />
              )}
              <span className="inline-flex items-center gap-1.5 shrink-0">
                {(f.subfolderCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Folder className="w-3 h-3" />
                    {f.subfolderCount}
                  </span>
                )}
                <span className="inline-flex items-center gap-0.5">
                  <File className="w-3 h-3" />
                  {f.contentCount ?? 0}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon" variant="secondary" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); toggleFolderStatus.mutate(f); }}
            title={f.status === 'published' ? 'Taslağa al' : 'Yayınla'}
          >
            {f.status === 'published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="icon" variant="secondary" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); openEditFolder(f); }}
            title="Düzenle"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon" variant="secondary" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setDeleteFolder(f); }}
            title="Sil"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    );
  };

  // ─── Render: Folder Detail view ──────────────────────────────────────────

  if (folderId) {
    return (
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Breadcrumb">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => navigate('/admin/partner-zone')}
            data-testid="breadcrumb-root"
          >
            <Home className="w-4 h-4 mr-1.5" />
            Partner Zone
          </Button>
          {breadcrumb.map((b, idx) => {
            const isLast = idx === breadcrumb.length - 1;
            return (
              <div key={b.id} className="flex items-center gap-1">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                {isLast ? (
                  <span className="px-2 py-1 text-foreground font-medium">{b.name}</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => navigate(`/admin/partner-zone/${b.id}`)}
                    data-testid={`breadcrumb-${b.id}`}
                  >
                    {b.name}
                  </Button>
                )}
              </div>
            );
          })}
        </nav>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-7 h-7 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{openFolder?.name ?? '...'}</h1>
                {openFolder && (
                  <Badge variant={openFolder.status === 'published' ? 'default' : 'secondary'}>
                    {openFolder.status === 'published' ? 'Yayında' : 'Taslak'}
                  </Badge>
                )}
              </div>
              {openFolder?.description && (
                <p className="text-muted-foreground text-sm mt-0.5">{openFolder.description}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openCreateFolder} data-testid="button-new-subfolder">
              <Plus className="w-4 h-4 mr-2" />
              Alt Klasör
            </Button>
            <Button variant="outline" onClick={() => openFolder && openEditFolder(openFolder)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Klasörü Düzenle
            </Button>
            <Button onClick={openCreateContent} data-testid="button-new-content">
              <Plus className="w-4 h-4 mr-2" />
              İçerik Ekle
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <PartnerToolbar
          search={search}
          onSearchChange={setSearch}
          country={country}
          onCountryChange={setCountry}
          countries={countries}
          showFileType
          fileType={fileType}
          onFileTypeChange={setFileType}
          sort={sort}
          onSortChange={setSort}
        />

        {detailLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /><span>Yükleniyor...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Subfolders grid */}
            {filteredSubfolders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Alt Klasörler
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredSubfolders.map(renderFolderCard)}
                </div>
              </div>
            )}

            {/* Contents table */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Dosyalar
              </h2>
              <Card>
                <CardContent className="p-0">
                  {filteredFolderContents.length === 0 ? (
                    <div className="text-center py-16">
                      <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                      <p className="text-muted-foreground">
                        {folderContents.length === 0
                          ? 'Bu klasörde henüz dosya yok. "İçerik Ekle" ile başlayın.'
                          : 'Filtrelere uygun dosya bulunamadı.'}
                      </p>
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
                        {filteredFolderContents.map((item) => {
                          const mt = getContentType(item);
                          const url = getContentUrl(item);
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <ContentIcon type={mt} className="w-7 h-7 text-primary opacity-70 shrink-0" />
                                  <div>
                                    <p className="font-medium text-sm">{item.displayName || item.title}</p>
                                    {item.description && (
                                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {MEDIA_TYPES.find((m) => m.value === mt)?.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">{item.fileSize || '—'}</span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={item.status === 'published' ? 'default' : 'secondary'}
                                  className="flex items-center gap-1 w-fit"
                                >
                                  {item.status === 'published' ? (
                                    <><CheckCircle2 className="w-3 h-3" />Yayında</>
                                  ) : (
                                    <><XCircle className="w-3 h-3" />Taslak</>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {dayjs(item.updatedAt).format('DD.MM.YYYY')}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  {url && (
                                    <Button size="icon" variant="ghost" asChild title="Aç">
                                      <a href={url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    </Button>
                                  )}
                                  {url && (
                                    <Button size="icon" variant="ghost" asChild title="İndir">
                                      <a href={url} download={item.displayName || item.title} target="_blank" rel="noopener noreferrer">
                                        <Download className="w-4 h-4" />
                                      </a>
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => openEditContent(item)}
                                    title="Düzenle"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setDeleteContent(item)}
                                    title="Sil"
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
            </div>
          </div>
        )}

        {/* Folder dialog (also used here for edit + new subfolder) */}
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
          countries={countries}
        />

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
        <AlertDialog open={!!deleteContent} onOpenChange={(o) => !o && setDeleteContent(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>İçeriği Sil</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteContent?.displayName || deleteContent?.title}" kalıcı olarak silinecek.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteContent && deleteContentMutation.mutate(deleteContent.id)}
                className="bg-destructive text-destructive-foreground"
              >
                Sil
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete folder confirm (for sub-folders shown in this view) */}
        <AlertDialog open={!!deleteFolder} onOpenChange={(o) => !o && setDeleteFolder(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Klasörü Sil</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteFolder?.name}" klasörünü silmek üzeresiniz. Klasör boş değilse silinemez (önce alt klasörleri ve dosyaları taşıyın veya silin).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteFolder && deleteFolderMutation.mutate(deleteFolder.id)}
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

  // ─── Render: Root folder list view ────────────────────────────────────────

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
        <Button onClick={openCreateFolder} data-testid="button-new-folder">
          <Plus className="w-4 h-4 mr-2" />
          Yeni Klasör
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Kök Klasör', value: rootFolders.length },
          { label: 'Yayınlanan', value: rootFolders.filter((f) => f.status === 'published').length },
          { label: 'Taslak', value: rootFolders.filter((f) => f.status === 'draft').length },
          { label: 'Toplam İçerik', value: rootFolders.reduce((s, f) => s + (f.contentCount ?? 0), 0) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <PartnerToolbar
        search={search}
        onSearchChange={setSearch}
        country={country}
        onCountryChange={setCountry}
        countries={countries}
        sort={sort}
        onSortChange={setSort}
      />

      {/* Folder grid */}
      {foldersLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /><span>Yükleniyor...</span>
        </div>
      ) : filteredRootFolders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Folder className="w-14 h-14 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">
              {rootFolders.length === 0
                ? 'Henüz klasör yok. "Yeni Klasör" ile başlayın.'
                : 'Filtrelere uygun klasör bulunamadı.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredRootFolders.map(renderFolderCard)}
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
        countries={countries}
      />

      {/* Delete folder confirm */}
      <AlertDialog open={!!deleteFolder} onOpenChange={(o) => !o && setDeleteFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Klasörü Sil</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteFolder?.name}" klasörünü silmek üzeresiniz. Klasör boş değilse silinemez (önce alt klasörleri ve dosyaları taşıyın veya silin).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFolder && deleteFolderMutation.mutate(deleteFolder.id)}
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

// ─── Folder Dialog ──────────────────────────────────────────────────────────

function FolderDialog({
  open, onOpenChange, form, onSubmit, isMutating, isEditing,
  coverPreview, coverUploading, coverInputRef, onCoverSelect, countries,
}: {
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
  countries: CountryItem[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Klasörü Düzenle' : 'Yeni Klasör'}</DialogTitle>
          <DialogDescription>
            Klasör adı, kapak görseli ve yayınlanma durumu gibi bilgileri ayarlayın.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Cover image */}
            <div className="space-y-2">
              <FormLabel>
                Kapak Görseli{' '}
                <span className="text-muted-foreground font-normal">(540×540 önerilen)</span>
              </FormLabel>
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
              <p className="text-xs text-muted-foreground">
                Yüklenen görseller sunucu tarafında en fazla 540×540 olacak şekilde küçültülür.
              </p>
              <input
                ref={coverInputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onCoverSelect(f);
                  e.target.value = '';
                }}
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
                <FormControl>
                  <Textarea {...field} value={field.value ?? ''} rows={2} placeholder="Klasör hakkında kısa açıklama..." />
                </FormControl>
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
                    onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                    value={field.value || '__none__'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Ülke seçin..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60">
                      <SelectItem value="__none__">— Ülke yok —</SelectItem>
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
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
                {isMutating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Kaydediliyor...</>
                ) : (
                  'Kaydet'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Content Dialog ─────────────────────────────────────────────────────────

function ContentDialog({
  open, onOpenChange, form, onSubmit, isMutating, isEditing,
  fileUploading, currentMediaEntry, fileInputRef, onFileSelect,
}: {
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
          <DialogDescription>
            Belge, video veya görsel yükleyin ve yayınlanma durumunu seçin.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Media type */}
            <FormField control={form.control} name="mediaType" render={({ field }) => (
              <FormItem>
                <FormLabel>İçerik Türü</FormLabel>
                <div className="grid grid-cols-3 gap-2">
                  {MEDIA_TYPES.map((mt) => {
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
                        className={`flex flex-col items-center gap-1.5 rounded-md border py-3 px-2 text-sm font-medium transition-colors ${
                          active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover-elevate'
                        }`}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileUploading}
                className="w-full"
              >
                {fileUploading ? (
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
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFileSelect(f);
                  e.target.value = '';
                }}
              />
            </div>

            {/* URL */}
            <FormField control={form.control} name="fileUrl" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <Link2 className="w-3 h-3" />URL{' '}
                  <span className="text-muted-foreground font-normal">(veya manuel gir)</span>
                </FormLabel>
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
                {isMutating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Kaydediliyor...</>
                ) : (
                  'Kaydet'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
