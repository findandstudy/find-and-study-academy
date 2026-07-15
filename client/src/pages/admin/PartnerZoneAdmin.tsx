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
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Package, Plus, Edit2, Trash2, Upload, Folder, FolderOpen,
  FileText, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  Video, Image as ImageIcon, File, Link2, Download,
  ChevronRight, Home, Search, ExternalLink, Minimize2, X,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import { CountryFlag } from '@/components/CountryFlag';
import { useTranslation } from 'react-i18next';
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
  contentTypes?: string[];
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
  if (type === 'video') return <Video className={className} />;
  if (type === 'image') return <ImageIcon className={className} />;
  return <FileText className={className} />;
}

// ─── Folder form ────────────────────────────────────────────────────────────

const folderSchema = z.object({
  name: z.string().min(1, 'folder_name_required'),
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
  title: z.string().min(1, 'title_required'),
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
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState(props.search);
  useEffect(() => { setLocalSearch(props.search); }, [props.search]);
  useEffect(() => {
    if (localSearch === props.search) return;
    const timer = setTimeout(() => props.onSearchChange(localSearch), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder={t('admin.partnerZone.allCountries')}
          className="pl-9"
          data-testid="input-admin-partner-search"
        />
      </div>
      <Select value={props.country} onValueChange={props.onCountryChange}>
        <SelectTrigger className="w-full sm:w-44" data-testid="select-admin-partner-country">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="all">{t('admin.partnerZone.allCountries')}</SelectItem>
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
            <SelectItem value="all">{t('admin.partnerZone.allTypes')}</SelectItem>
            <SelectItem value="document">{t('common.document')}</SelectItem>
            <SelectItem value="video">{t('common.video')}</SelectItem>
            <SelectItem value="image">{t('common.image')}</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Select value={props.sort} onValueChange={(v) => props.onSortChange(v as SortKey)}>
        <SelectTrigger className="w-full sm:w-40" data-testid="select-admin-partner-sort">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">{t('admin.partnerZone.newestFirst')}</SelectItem>
          <SelectItem value="oldest">{t('admin.partnerZone.oldestFirst')}</SelectItem>
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
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [, params] = useRoute('/admin/partner-zone/:folderId');
  const [, navigate] = useLocation();
  const folderId = params?.folderId ?? null;

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('all');
  const [fileType, setFileType] = useState<FileTypeFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<PartnerFolder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<PartnerFolder | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [resizeConfirmOpen, setResizeConfirmOpen] = useState(false);
  const [pendingCoverUrl, setPendingCoverUrl] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<FolderContent | null>(null);
  const [deleteContent, setDeleteContent] = useState<FolderContent | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragItem, setDragItem] = useState<
    | { kind: 'folder'; id: string; name: string; currentParentId: string | null }
    | { kind: 'content'; ids: string[]; primaryId: string; name: string; currentFolderId: string | null }
    | null
  >(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  useEffect(() => {
    setSelectedContentIds(new Set());
    setLastClickedIndex(null);
  }, [folderId]);

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
  const subfolders = folderDetailData?.subfolders ?? [];
  const breadcrumb = folderDetailData?.breadcrumb ?? [];

  // ─── Filtering ──────────────────────────────────────────────────────────

  const filteredRootFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortFolders(
      rootFolders.filter((f) => {
        if (q && !f.name.toLowerCase().includes(q)) return false;
        if (country !== 'all' && f.countryCode !== country) return false;
        return true;
      }),
      sort,
    );
  }, [rootFolders, search, country, sort]);

  const filteredSubfolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortFolders(
      subfolders.filter((f) => {
        if (q && !f.name.toLowerCase().includes(q)) return false;
        if (country !== 'all' && f.countryCode !== country) return false;
        return true;
      }),
      sort,
    );
  }, [subfolders, search, country, sort]);

  const filteredFolderContents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortContents(
      folderContents.filter((item) => {
        const name = (item.displayName ?? item.title).toLowerCase();
        if (q && !name.includes(q)) return false;
        if (fileType !== 'all' && getContentType(item) !== fileType) return false;
        return true;
      }),
      sort,
    );
  }, [folderContents, search, fileType, sort]);

  // ─── Multi-select helpers ────────────────────────────────────────────────

  const allVisibleSelected = filteredFolderContents.length > 0 &&
    filteredFolderContents.every((item) => selectedContentIds.has(item.id));
  const someVisibleSelected = filteredFolderContents.some((item) => selectedContentIds.has(item.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedContentIds((prev) => {
        const next = new Set(prev);
        filteredFolderContents.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedContentIds((prev) => {
        const next = new Set(prev);
        filteredFolderContents.forEach((item) => next.add(item.id));
        return next;
      });
    }
    setLastClickedIndex(null);
  };

  const handleRowSelectClick = (id: string, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndex !== null) {
      const min = Math.min(lastClickedIndex, index);
      const max = Math.max(lastClickedIndex, index);
      const range = filteredFolderContents.slice(min, max + 1).map((item) => item.id);
      setSelectedContentIds((prev) => {
        const next = new Set(prev);
        range.forEach((rid) => next.add(rid));
        return next;
      });
    } else {
      setSelectedContentIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastClickedIndex(index);
    }
  };

  const clearSelection = () => {
    setSelectedContentIds(new Set());
    setLastClickedIndex(null);
  };

  // ─── Forms ──────────────────────────────────────────────────────────────

  const folderForm = useForm<FolderFormValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: { name: '', description: '', categoryTag: '', countryCode: '', order: 0, status: 'draft' },
  });

  const contentForm = useForm<ContentFormValues>({
    resolver: zodResolver(contentSchema),
    defaultValues: { mediaType: 'document', title: '', description: '', displayName: '', fileSize: '', fileUrl: '', status: 'draft' },
  });

  const mediaType = contentForm.watch('mediaType');
  const MEDIA_TYPES = [
    { value: 'document' as MediaType, label: t('common.document'), icon: FileText, accept: '.pdf,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.zip', folder: 'documents' },
    { value: 'video' as MediaType, label: t('common.video'), icon: Video, accept: '.mp4,.mov,.webm,.avi,.mkv', folder: 'videos' },
    { value: 'image' as MediaType, label: t('common.image'), icon: ImageIcon, accept: '.jpg,.jpeg,.png,.gif,.webp,.svg', folder: 'images' },
  ];
  const currentMediaEntry = MEDIA_TYPES.find((m) => m.value === mediaType) ?? MEDIA_TYPES[0];

  const openCreateFolder = () => {
    setEditingFolder(null);
    setCoverPreview(null);
    setPendingCoverUrl(null);
    folderForm.reset({ name: '', description: '', categoryTag: '', countryCode: '', order: 0, status: 'draft' });
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
      order: f.order ?? 0,
      status: f.status as 'draft' | 'published',
    });
    setFolderDialogOpen(true);
  };

  const openCreateContent = () => {
    setEditingContent(null);
    contentForm.reset({ mediaType: 'document', title: '', description: '', displayName: '', fileSize: '', fileUrl: '', status: 'draft' });
    setContentDialogOpen(true);
  };

  const openEditContent = (item: FolderContent) => {
    setEditingContent(item);
    const mt = getContentType(item);
    contentForm.reset({
      mediaType: mt,
      title: item.title,
      description: item.description ?? '',
      displayName: item.displayName ?? '',
      fileSize: item.fileSize ?? '',
      fileUrl: getContentUrl(item) ?? '',
      status: item.status as 'draft' | 'published',
    });
    setContentDialogOpen(true);
  };

  // ─── Cover upload ────────────────────────────────────────────────────────

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/partner-folders/upload-cover', {
        method: 'POST',
        headers: { 'x-user-id': user?.id ?? '', 'x-user-role': user?.role ?? '' },
        body: fd,
      });
      if (!res.ok) throw new Error();
      const data: { url?: string } = await res.json();
      if (data.url) {
        setCoverPreview(data.url);
        setPendingCoverUrl(data.url);
        toast({ title: t('admin.partnerZone.coverUploaded'), description: t('admin.partnerZone.coverUploadedDesc') });
      }
    } catch {
      toast({ title: t('admin.partnerZone.coverUploadError'), variant: 'destructive' });
    } finally {
      setCoverUploading(false);
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: async (values: FolderFormValues) => {
      const payload = { ...values, coverImageUrl: pendingCoverUrl, parentFolderId: folderId ?? null };
      const r = await apiRequest('POST', '/api/admin/partner-folders', payload);
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders'] });
      toast({ title: t('admin.partnerZone.folderCreated') });
      setFolderDialogOpen(false);
      setPendingCoverUrl(null);
    },
    onError: () => toast({ title: t('common.error'), description: t('admin.partnerZone.folderCreateFailed'), variant: 'destructive' }),
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
      toast({ title: t('admin.partnerZone.folderUpdated') });
      setFolderDialogOpen(false);
      setPendingCoverUrl(null);
    },
    onError: () => toast({ title: t('common.error'), description: t('admin.partnerZone.folderUpdateFailed'), variant: 'destructive' }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest('DELETE', `/api/admin/partner-folders/${id}`);
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.message ?? t('admin.partnerZone.folderDeleteFailed'));
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders'] });
      toast({ title: t('admin.partnerZone.folderDeleted') });
      setDeleteFolder(null);
    },
    onError: (err: Error) => {
      toast({ title: t('admin.partnerZone.folderDeleteFailed'), description: err.message, variant: 'destructive' });
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

  const resizeCoversMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest('POST', '/api/admin/partner-folders/resize-covers');
      return r.json();
    },
    onSuccess: (data) => {
      const s = data?.summary;
      if (!s) {
        toast({ title: t('common.success'), description: t('admin.partnerZone.coverUploadedDesc') });
        return;
      }
      toast({
        title: t('admin.partnerZone.resizeCovers'),
        description:
          `${s.resized}/${s.total} resized • ${s.mbSaved} MB saved ` +
          `(already small: ${s.skippedAlreadySmall}, missing: ${s.skippedMissing}, errors: ${s.errors})`,
      });
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err instanceof Error ? err.message : t('common.error'),
        variant: 'destructive',
      });
    },
  });

  const onFolderSubmit = (values: FolderFormValues) => {
    if (editingFolder) updateFolderMutation.mutate(values);
    else createFolderMutation.mutate(values);
  };

  // ─── Content mutations ───────────────────────────────────────────────────

  const handleFileUpload = async (file: File) => {
    setFileUploading(true);
    try {
      const mt = contentForm.getValues('mediaType');
      const entry = MEDIA_TYPES.find((m) => m.value === mt) ?? MEDIA_TYPES[0];
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', entry.folder);
      const res = await fetch('/api/uploads/content', {
        method: 'POST',
        headers: { 'x-user-id': user?.id ?? '' },
        body: fd,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const url = data?.url || data?.fileUrl || data?.path;
      if (!url) throw new Error('No URL returned');
      contentForm.setValue('fileUrl', url);
      const sizeKb = file.size / 1024;
      contentForm.setValue('fileSize', sizeKb < 1024
        ? `${sizeKb.toFixed(0)} KB`
        : `${(sizeKb / 1024).toFixed(1)} MB`);
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof Error ? err.message : t('common.error'), variant: 'destructive' });
    } finally {
      setFileUploading(false);
    }
  };

  const createContentMutation = useMutation({
    mutationFn: async (values: ContentFormValues) => {
      const payload = {
        title: values.title,
        description: values.description || null,
        displayName: values.displayName || null,
        fileSize: values.fileSize || null,
        status: values.status,
        folderId: folderId ?? null,
        type: values.mediaType,
        contentType: values.mediaType,
        ...(values.mediaType === 'document' ? { documentUrl: values.fileUrl || null } : {}),
        ...(values.mediaType === 'video' ? { videoUrl: values.fileUrl || null } : {}),
        ...(values.mediaType === 'image' ? { imageUrl: values.fileUrl || null } : {}),
      };
      const r = await apiRequest('POST', '/api/admin/partner-contents', payload);
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', folderId] });
      setContentDialogOpen(false);
    },
    onError: () => toast({ title: t('common.error'), variant: 'destructive' }),
  });

  const updateContentMutation = useMutation({
    mutationFn: async (values: ContentFormValues) => {
      if (!editingContent) return;
      const payload = {
        title: values.title,
        description: values.description || null,
        displayName: values.displayName || null,
        fileSize: values.fileSize || null,
        status: values.status,
        type: values.mediaType,
        contentType: values.mediaType,
        ...(values.mediaType === 'document' ? { documentUrl: values.fileUrl || null } : {}),
        ...(values.mediaType === 'video' ? { videoUrl: values.fileUrl || null } : {}),
        ...(values.mediaType === 'image' ? { imageUrl: values.fileUrl || null } : {}),
      };
      const r = await apiRequest('PATCH', `/api/admin/partner-contents/${editingContent.id}`, payload);
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', folderId] });
      setContentDialogOpen(false);
    },
    onError: () => toast({ title: t('common.error'), variant: 'destructive' }),
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest('DELETE', `/api/admin/partner-contents/${id}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', folderId] });
      setDeleteContent(null);
    },
    onError: () => toast({ title: t('common.error'), variant: 'destructive' }),
  });

  const bulkDeleteContentsMutation = useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      const r = await apiRequest('POST', '/api/admin/contents/bulk-delete', { ids });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.message ?? t('common.error'));
      return body as { deleted: number; failed: number; total: number };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', folderId] });
      setSelectedContentIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        variables.ids.forEach((id) => next.delete(id));
        return next;
      });
      setLastClickedIndex(null);
      setBulkDeleteConfirmOpen(false);
      const deleted = data?.deleted ?? variables.ids.length;
      const failed = data?.failed ?? 0;
      toast({
        title: failed > 0 ? t('admin.partnerZone.bulkDeleteFailed') : t('admin.partnerZone.bulkDeleted'),
        description: failed > 0
          ? t('admin.partnerZone.bulkDeletedDesc', { deleted, failed })
          : t('admin.partnerZone.bulkDeletedDescSuccess', { deleted }),
        variant: failed > 0 ? 'destructive' : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: 'published' | 'draft' }) => {
      const r = await apiRequest('POST', '/api/admin/contents/bulk-status', { ids, status });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.message ?? t('common.error'));
      return body as { updated: number; failed: number; total: number; status: 'published' | 'draft' };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', folderId] });
      setSelectedContentIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        variables.ids.forEach((id) => next.delete(id));
        return next;
      });
      setLastClickedIndex(null);
      const updated = data?.updated ?? variables.ids.length;
      const failed = data?.failed ?? 0;
      const statusLabel = variables.status === 'published' ? t('common.published') : t('common.draft');
      toast({
        title: failed > 0 ? t('admin.partnerZone.bulkStatusFailed') : t('admin.partnerZone.bulkStatusUpdated'),
        description: failed > 0
          ? t('admin.partnerZone.bulkStatusDesc', { updated, failed })
          : t('admin.partnerZone.bulkStatusDescSuccess', { updated, status: statusLabel }),
        variant: failed > 0 ? 'destructive' : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const onContentSubmit = (values: ContentFormValues) => {
    if (editingContent) updateContentMutation.mutate(values);
    else createContentMutation.mutate(values);
  };

  const isFolderMutating = createFolderMutation.isPending || updateFolderMutation.isPending;
  const isContentMutating = createContentMutation.isPending || updateContentMutation.isPending;

  // ─── Drag & drop ─────────────────────────────────────────────────────────

  const invalidatePartnerFolders = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders'] });
  };

  const moveFolderMutation = useMutation({
    mutationFn: async ({ id, parentFolderId }: { id: string; parentFolderId: string | null }) => {
      const r = await apiRequest('PATCH', `/api/admin/partner-folders/${id}`, { parentFolderId });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.message ?? t('admin.partnerZone.folderMoveFailed'));
      return body;
    },
    onSuccess: () => {
      invalidatePartnerFolders();
      toast({ title: t('admin.partnerZone.folderMoved') });
    },
    onError: (err: Error) => {
      toast({ title: t('admin.partnerZone.folderMoveFailed'), description: err.message, variant: 'destructive' });
    },
  });

  const moveContentsMutation = useMutation({
    mutationFn: async ({ ids, folderId: targetFolderId }: { ids: string[]; folderId: string | null }) => {
      const r = await apiRequest('POST', '/api/admin/contents/bulk-move', { ids, folderId: targetFolderId });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.message ?? t('common.error'));
      return body as { moved: number; failed: number; total: number };
    },
    onSuccess: (data, variables) => {
      invalidatePartnerFolders();
      setSelectedContentIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        variables.ids.forEach((id) => next.delete(id));
        return next;
      });
      const moved = data?.moved ?? variables.ids.length;
      const failed = data?.failed ?? 0;
      toast({
        title: failed > 0 ? t('admin.partnerZone.filesMovedFailed') : t('admin.partnerZone.filesMoved'),
        description: failed > 0
          ? t('admin.partnerZone.filesMovedDesc', { moved, failed })
          : t('admin.partnerZone.filesMovedDescSuccess', { moved }),
        variant: failed > 0 ? 'destructive' : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  // ─── Drop target helpers ─────────────────────────────────────────────────

  const dropTargetProps = (
    target: { kind: 'root' } | { kind: 'folder'; id: string },
    key: string,
  ) => {
    const targetId = target.kind === 'root' ? 'root' : target.id;
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!dragItem) return;
        if (dragItem.kind === 'folder') {
          if (target.kind === 'folder' && target.id === dragItem.id) return;
          if (target.kind === 'folder' && target.id === dragItem.currentParentId) return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTargetId(key);
      },
      onDragLeave: () => setDropTargetId((prev) => (prev === key ? null : prev)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDropTargetId(null);
        if (!dragItem) return;
        if (dragItem.kind === 'folder') {
          const newParent = target.kind === 'root' ? null : target.id;
          if (newParent === dragItem.currentParentId) return;
          moveFolderMutation.mutate({ id: dragItem.id, parentFolderId: newParent });
        } else {
          const newFolder = target.kind === 'root' ? null : target.id;
          if (newFolder === dragItem.currentFolderId) return;
          moveContentsMutation.mutate({ ids: dragItem.ids, folderId: newFolder });
        }
        setDragItem(null);
      },
    };
  };

  // ─── Folder card renderer ────────────────────────────────────────────────

  const renderFolderCard = (f: PartnerFolder) => {
    const country = countries.find((c) => c.code === f.countryCode) ?? null;
    const isDropTarget = dropTargetId === `folder-${f.id}`;
    return (
      <div
        key={f.id}
        className="relative group"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', f.id);
          setDragItem({ kind: 'folder', id: f.id, name: f.name, currentParentId: f.parentFolderId });
        }}
        onDragEnd={() => { setDragItem(null); setDropTargetId(null); }}
        {...dropTargetProps({ kind: 'folder', id: f.id }, `folder-${f.id}`)}
        data-testid={`folder-card-wrapper-${f.id}`}
      >
        <div
          className={`rounded-md border overflow-hidden cursor-pointer hover-elevate ${
            isDropTarget ? 'ring-2 ring-primary border-primary' : ''
          }`}
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
                {f.status === 'published' ? t('common.published') : t('common.draft')}
              </Badge>
            </div>
          </div>
          <div className="p-3 space-y-2">
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
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={(e) => { e.stopPropagation(); navigate(`/admin/partner-zone/${f.id}`); }}
              data-testid={`button-open-folder-${f.id}`}
            >
              {t('admin.partnerZone.open')}
            </Button>
          </div>
        </div>

        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon" variant="secondary" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); toggleFolderStatus.mutate(f); }}
            title={f.status === 'published' ? t('admin.partnerZone.unpublish') : t('admin.partnerZone.publish')}
          >
            {f.status === 'published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="icon" variant="secondary" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); openEditFolder(f); }}
            title={t('common.edit')}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon" variant="secondary" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setDeleteFolder(f); }}
            title={t('common.delete')}
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
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Breadcrumb">
          <div
            className={`rounded-md ${dropTargetId === 'breadcrumb-root' ? 'ring-2 ring-primary' : ''}`}
            {...dropTargetProps({ kind: 'root' }, 'breadcrumb-root')}
          >
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
          </div>
          {breadcrumb.map((b, idx) => {
            const isLast = idx === breadcrumb.length - 1;
            return (
              <div key={b.id} className="flex items-center gap-1">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                {isLast ? (
                  <span className="px-2 py-1 text-foreground font-medium">{b.name}</span>
                ) : (
                  <div
                    className={`rounded-md ${dropTargetId === `breadcrumb-${b.id}` ? 'ring-2 ring-primary' : ''}`}
                    {...dropTargetProps({ kind: 'folder', id: b.id }, `breadcrumb-${b.id}`)}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => navigate(`/admin/partner-zone/${b.id}`)}
                      data-testid={`breadcrumb-${b.id}`}
                    >
                      {b.name}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-7 h-7 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{openFolder?.name ?? '...'}</h1>
                {openFolder && (
                  <Badge variant={openFolder.status === 'published' ? 'default' : 'secondary'}>
                    {openFolder.status === 'published' ? t('common.published') : t('common.draft')}
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
              {t('admin.partnerZone.newSubfolder')}
            </Button>
            <Button variant="outline" onClick={() => openFolder && openEditFolder(openFolder)}>
              <Edit2 className="w-4 h-4 mr-2" />
              {t('admin.partnerZone.editFolder')}
            </Button>
            <Button variant="outline" onClick={() => setBulkDialogOpen(true)} data-testid="button-bulk-upload">
              <Upload className="w-4 h-4 mr-2" />
              {t('admin.partnerZone.bulkUpload', { defaultValue: 'Toplu Yükle' })}
            </Button>
            <Button onClick={openCreateContent} data-testid="button-new-content">
              <Plus className="w-4 h-4 mr-2" />
              {t('admin.partnerZone.addContent')}
            </Button>
          </div>
        </div>

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
            <Loader2 className="w-5 h-5 animate-spin" /><span>{t('admin.partnerZone.loading')}</span>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredSubfolders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('admin.partnerZone.subfolders')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredSubfolders.map(renderFolderCard)}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('admin.partnerZone.files')}
                </h2>
                {selectedContentIds.size > 0 && (
                  <div
                    className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1"
                    data-testid="bulk-selection-toolbar"
                  >
                    <Badge variant="secondary" data-testid="bulk-selection-count">
                      {t('admin.partnerZone.itemsSelected', { count: selectedContentIds.size })}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden lg:inline">
                      {t('admin.partnerZone.dragOrBulk')}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkUpdateStatusMutation.isPending || bulkDeleteContentsMutation.isPending}
                      onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedContentIds), status: 'published' })}
                      data-testid="button-bulk-publish"
                    >
                      {bulkUpdateStatusMutation.isPending && bulkUpdateStatusMutation.variables?.status === 'published' ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 mr-1" />
                      )}
                      {t('admin.partnerZone.publish')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkUpdateStatusMutation.isPending || bulkDeleteContentsMutation.isPending}
                      onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedContentIds), status: 'draft' })}
                      data-testid="button-bulk-draft"
                    >
                      {bulkUpdateStatusMutation.isPending && bulkUpdateStatusMutation.variables?.status === 'draft' ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 mr-1" />
                      )}
                      {t('admin.partnerZone.unpublish')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={bulkUpdateStatusMutation.isPending || bulkDeleteContentsMutation.isPending}
                      onClick={() => setBulkDeleteConfirmOpen(true)}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {t('common.delete')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearSelection}
                      data-testid="button-clear-selection"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      {t('admin.partnerZone.clear')}
                    </Button>
                  </div>
                )}
              </div>
              <Card>
                <CardContent className="p-0">
                  {filteredFolderContents.length === 0 ? (
                    <div className="text-center py-16">
                      <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                      <p className="text-muted-foreground">
                        {folderContents.length === 0
                          ? t('admin.partnerZone.noFiles')
                          : t('admin.partnerZone.noFilesFiltered')}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                              onCheckedChange={toggleSelectAllVisible}
                              aria-label={t('admin.partnerZone.selectAll')}
                              data-testid="checkbox-select-all"
                            />
                          </TableHead>
                          <TableHead>{t('common.title')}</TableHead>
                          <TableHead>{t('admin.partnerZone.type')}</TableHead>
                          <TableHead>{t('admin.partnerZone.size')}</TableHead>
                          <TableHead>{t('common.status')}</TableHead>
                          <TableHead>{t('admin.partnerZone.updated')}</TableHead>
                          <TableHead className="text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFolderContents.map((item, index) => {
                          const mt = getContentType(item);
                          const url = getContentUrl(item);
                          const isSelected = selectedContentIds.has(item.id);
                          const isInActiveDrag =
                            dragItem?.kind === 'content' && dragItem.ids.includes(item.id);
                          return (
                            <TableRow
                              key={item.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                const ids = isSelected && selectedContentIds.size > 0
                                  ? Array.from(selectedContentIds)
                                  : [item.id];
                                e.dataTransfer.setData('text/plain', ids.join(','));
                                setDragItem({
                                  kind: 'content',
                                  ids,
                                  primaryId: item.id,
                                  name: ids.length > 1
                                    ? `${ids.length} files`
                                    : item.displayName || item.title,
                                  currentFolderId: item.folderId,
                                });
                              }}
                              onDragEnd={() => { setDragItem(null); setDropTargetId(null); }}
                              className={`cursor-grab active:cursor-grabbing ${
                                isInActiveDrag ? 'opacity-50' : ''
                              }`}
                              onClick={(e) => {
                                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                  e.preventDefault();
                                  handleRowSelectClick(item.id, index, e);
                                }
                              }}
                            >
                              <TableCell
                                onClick={(e) => {
                                  if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                    e.preventDefault();
                                    handleRowSelectClick(item.id, index, e);
                                  }
                                }}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowSelectClick(item.id, index, e);
                                  }}
                                  aria-label={`${item.displayName || item.title}`}
                                  data-testid={`checkbox-content-${item.id}`}
                                />
                              </TableCell>
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
                                    <><CheckCircle2 className="w-3 h-3" />{t('common.published')}</>
                                  ) : (
                                    <><XCircle className="w-3 h-3" />{t('common.draft')}</>
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
                                    <Button size="icon" variant="ghost" asChild title={t('admin.partnerZone.open')}>
                                      <a href={url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    </Button>
                                  )}
                                  {url && (
                                    <Button size="icon" variant="ghost" asChild title={t('admin.partnerZone.download')}>
                                      <a href={url} download={item.displayName || item.title} target="_blank" rel="noopener noreferrer">
                                        <Download className="w-4 h-4" />
                                      </a>
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => openEditContent(item)}
                                    title={t('common.edit')}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setDeleteContent(item)}
                                    title={t('common.delete')}
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

        <BulkUploadDialog
          open={bulkDialogOpen}
          onOpenChange={setBulkDialogOpen}
          folderId={folderId}
          user={user}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/partner-folders', folderId] })}
        />

        <AlertDialog open={!!deleteContent} onOpenChange={(o) => !o && setDeleteContent(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('admin.partnerZone.deleteContentTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin.partnerZone.deleteContentDesc', { name: deleteContent?.displayName || deleteContent?.title || '' })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteContent && deleteContentMutation.mutate(deleteContent.id)}
                className="bg-destructive text-destructive-foreground"
              >
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('admin.partnerZone.deleteContentTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin.partnerZone.itemsSelected', { count: selectedContentIds.size })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkDeleteContentsMutation.isPending}>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={bulkDeleteContentsMutation.isPending || selectedContentIds.size === 0}
                onClick={(e) => {
                  e.preventDefault();
                  bulkDeleteContentsMutation.mutate({ ids: Array.from(selectedContentIds) });
                }}
                className="bg-destructive text-destructive-foreground"
                data-testid="button-confirm-bulk-delete"
              >
                {bulkDeleteContentsMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{t('common.loading')}</>
                ) : (
                  <>{t('common.delete')} ({selectedContentIds.size})</>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteFolder} onOpenChange={(o) => !o && setDeleteFolder(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('admin.partnerZone.deleteFolderTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin.partnerZone.deleteFolderDesc', { name: deleteFolder?.name || '' })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteFolder && deleteFolderMutation.mutate(deleteFolder.id)}
                className="bg-destructive text-destructive-foreground"
              >
                {t('common.delete')}
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" />
            {t('admin.partnerZone.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.partnerZone.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AlertDialog open={resizeConfirmOpen} onOpenChange={setResizeConfirmOpen}>
            <Button
              variant="outline"
              onClick={() => setResizeConfirmOpen(true)}
              disabled={resizeCoversMutation.isPending}
              data-testid="button-resize-covers"
              title={t('admin.partnerZone.resizeCoversTitle')}
            >
              {resizeCoversMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Minimize2 className="w-4 h-4 mr-2" />
              )}
              {t('admin.partnerZone.resizeCovers')}
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('admin.partnerZone.resizeCoversTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('admin.partnerZone.resizeCoversDesc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-resize">{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setResizeConfirmOpen(false);
                    resizeCoversMutation.mutate();
                  }}
                  data-testid="button-confirm-resize"
                >
                  {t('admin.partnerZone.shrink')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={openCreateFolder} data-testid="button-new-folder">
            <Plus className="w-4 h-4 mr-2" />
            {t('admin.partnerZone.newFolder')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('admin.partnerZone.rootFolders'), value: rootFolders.length },
          { label: t('admin.partnerZone.published'), value: rootFolders.filter((f) => f.status === 'published').length },
          { label: t('admin.partnerZone.draft'), value: rootFolders.filter((f) => f.status === 'draft').length },
          { label: t('admin.partnerZone.totalContent'), value: rootFolders.reduce((s, f) => s + (f.contentCount ?? 0), 0) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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

      {foldersLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /><span>{t('admin.partnerZone.loading')}</span>
        </div>
      ) : filteredRootFolders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Folder className="w-14 h-14 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">
              {rootFolders.length === 0
                ? t('admin.partnerZone.noFolders')
                : t('admin.partnerZone.noFoldersFiltered')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredRootFolders.map(renderFolderCard)}
        </div>
      )}

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

      <AlertDialog open={!!deleteFolder} onOpenChange={(o) => !o && setDeleteFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.partnerZone.deleteFolderTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.partnerZone.deleteFolderDesc', { name: deleteFolder?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFolder && deleteFolderMutation.mutate(deleteFolder.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {t('common.delete')}
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
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('admin.partnerZone.editFolder') : t('admin.partnerZone.newFolder')}</DialogTitle>
          <DialogDescription>
            {t('admin.partnerZone.folderDialogDesc')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <FormLabel>
                {t('admin.partnerZone.coverImageLabel')}
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
                    <span className="text-sm">{t('admin.partnerZone.coverImageHint')}</span>
                  </div>
                )}
                {coverUploading && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('admin.partnerZone.coverImageResizeNote')}
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

            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.partnerZone.folderNameLabel')}</FormLabel>
                <FormControl><Input {...field} placeholder="e.g. Pathway Flyers" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.partnerZone.descriptionLabel')} <span className="text-muted-foreground font-normal">({t('common.optional')})</span></FormLabel>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ''} rows={2} placeholder={t('admin.partnerZone.descriptionPlaceholder')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="categoryTag" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.partnerZone.categoryLabel')}</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('admin.partnerZone.categoryPlaceholder')} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="countryCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.partnerZone.countryLabel')}</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                    value={field.value || '__none__'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('admin.partnerZone.countryPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60">
                      <SelectItem value="__none__">{t('admin.partnerZone.noCountry')}</SelectItem>
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="order" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.partnerZone.orderLabel')}</FormLabel>
                  <FormControl><Input {...field} type="number" min={0} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.partnerZone.statusLabel')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="draft">{t('admin.partnerZone.draftOption')}</SelectItem>
                      <SelectItem value="published">{t('admin.partnerZone.publishedOption')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('common.saving')}</>
                ) : (
                  t('common.save')
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
  currentMediaEntry: { value: MediaType; label: string; icon: React.ElementType; accept: string; folder: string };
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (file: File) => void;
}) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);
  const MEDIA_TYPES = [
    { value: 'document' as MediaType, label: t('common.document'), icon: FileText, accept: '.pdf,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.zip', folder: 'documents' },
    { value: 'video' as MediaType, label: t('common.video'), icon: Video, accept: '.mp4,.mov,.webm,.avi,.mkv', folder: 'videos' },
    { value: 'image' as MediaType, label: t('common.image'), icon: ImageIcon, accept: '.jpg,.jpeg,.png,.gif,.webp,.svg', folder: 'images' },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('admin.partnerZone.contentDialogTitleEdit') : t('admin.partnerZone.contentDialogTitleNew')}</DialogTitle>
          <DialogDescription>
            {t('admin.partnerZone.contentDialogDesc')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="mediaType" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.partnerZone.contentTypeLabel')}</FormLabel>
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

            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.partnerZone.titleLabel')}</FormLabel>
                <FormControl><Input {...field} placeholder={`${currentMediaEntry.label} title`} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="displayName" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.partnerZone.displayNameLabel')} <span className="text-muted-foreground font-normal">({t('common.optional')})</span></FormLabel>
                <FormControl><Input {...field} placeholder={t('admin.partnerZone.displayNamePlaceholder')} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.partnerZone.descriptionLabel')}</FormLabel>
                <FormControl><Textarea {...field} value={field.value ?? ''} rows={2} placeholder="..." /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="space-y-2">
              <FormLabel>{t('admin.partnerZone.uploadFileLabel')}</FormLabel>
              <div
                onClick={() => { if (!fileUploading) fileInputRef.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); if (!fileUploading) setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (fileUploading) return;
                  const f = e.dataTransfer.files?.[0];
                  if (f) onFileSelect(f);
                }}
                role="button"
                tabIndex={0}
                data-testid="dropzone-content-file"
                className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-sm text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover-elevate'
                } ${fileUploading ? 'pointer-events-none opacity-70' : ''}`}
              >
                {fileUploading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />{t('admin.partnerZone.uploading')}</>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span className="font-medium">{currentMediaEntry.label}</span>
                    <span className="text-xs opacity-80">{t('admin.partnerZone.dropOrClickHint', { defaultValue: 'Drag & drop or click to select' })}</span>
                  </>
                )}
              </div>
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

            <FormField control={form.control} name="fileUrl" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <Link2 className="w-3 h-3" />{t('admin.partnerZone.urlLabel')}
                </FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} placeholder="https://..." /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="fileSize" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.partnerZone.fileSizeLabel')} <span className="text-muted-foreground font-normal">({t('common.optional')})</span></FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('admin.partnerZone.fileSizePlaceholder')} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.partnerZone.statusLabel')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="draft">{t('admin.partnerZone.draftOption')}</SelectItem>
                    <SelectItem value="published">{t('admin.partnerZone.publishedOption')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('common.saving')}</>
                ) : (
                  t('common.save')
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


// ─── Bulk Upload Dialog: pick many files, each becomes a content item ────────
function BulkUploadDialog({
  open, onOpenChange, folderId, user, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderId: string | null;
  user: { id?: string; role?: string } | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const BULK_MEDIA = [
    { value: 'document' as MediaType, label: t('common.document'), icon: FileText, accept: '.pdf,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.zip', folder: 'documents' },
    { value: 'video' as MediaType, label: t('common.video'), icon: Video, accept: '.mp4,.mov,.webm,.avi,.mkv', folder: 'videos' },
    { value: 'image' as MediaType, label: t('common.image'), icon: ImageIcon, accept: '.jpg,.jpeg,.png,.gif,.webp,.svg', folder: 'images' },
  ];
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [status, setStatus] = useState('draft');
  const [items, setItems] = useState<{ file: File; state: 'pending' | 'uploading' | 'done' | 'error'; error?: string }[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const entry = BULK_MEDIA.find((m) => m.value === mediaType) ?? BULK_MEDIA[0];

  const humanSize = (bytes: number) => {
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  };
  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setItems((prev) => [...prev, ...arr.map((file) => ({ file, state: 'pending' as const }))]);
  };
  const reset = () => { setItems([]); setRunning(false); };

  const uploadAll = async () => {
    if (running || items.length === 0) return;
    setRunning(true);
    const snapshot = items;
    let ok = 0, fail = 0;
    for (let i = 0; i < snapshot.length; i++) {
      if (snapshot[i].state === 'done') continue;
      setItems((prev) => prev.map((p, idx) => (idx === i ? { ...p, state: 'uploading', error: undefined } : p)));
      try {
        const fd = new FormData();
        fd.append('file', snapshot[i].file);
        fd.append('folder', entry.folder);
        const up = await fetch('/api/uploads/content', {
          method: 'POST',
          headers: { 'x-user-id': user?.id ?? '', 'x-user-role': user?.role ?? '' },
          body: fd,
        });
        if (!up.ok) throw new Error(`upload ${up.status}`);
        const data = await up.json();
        const url = data?.url || data?.fileUrl || data?.path;
        if (!url) throw new Error('no url');
        const title = snapshot[i].file.name.replace(/\.[^.]+$/, '');
        const payload: Record<string, unknown> = {
          title,
          displayName: snapshot[i].file.name,
          description: null,
          fileSize: humanSize(snapshot[i].file.size),
          status,
          folderId: folderId ?? null,
          type: mediaType,
          contentType: mediaType,
        };
        if (mediaType === 'document') payload.documentUrl = url;
        if (mediaType === 'video') payload.videoUrl = url;
        if (mediaType === 'image') payload.imageUrl = url;
        const cr = await apiRequest('POST', '/api/admin/partner-contents', payload);
        if (!cr.ok) throw new Error('save failed');
        ok++;
        setItems((prev) => prev.map((p, idx) => (idx === i ? { ...p, state: 'done' } : p)));
      } catch (err) {
        fail++;
        setItems((prev) => prev.map((p, idx) => (idx === i ? { ...p, state: 'error', error: err instanceof Error ? err.message : 'error' } : p)));
      }
    }
    setRunning(false);
    onDone();
    toast({
      title: t('common.success', { defaultValue: 'Done' }),
      description: `${ok} ✓${fail ? ` · ${fail} ✕` : ''}`,
      variant: fail && !ok ? 'destructive' : 'default',
    });
  };

  const doneCount = items.filter((i) => i.state === 'done').length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!running) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('admin.partnerZone.bulkUploadTitle', { defaultValue: 'Toplu Yükle' })}</DialogTitle>
          <DialogDescription>
            {t('admin.partnerZone.bulkUploadDesc', { defaultValue: 'Birden fazla dosya seç — her biri ayrı içerik olarak eklenir.' })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {BULK_MEDIA.map((mt) => {
              const Icon = mt.icon;
              const active = mediaType === mt.value;
              return (
                <button
                  key={mt.value}
                  type="button"
                  disabled={running}
                  onClick={() => setMediaType(mt.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-md border py-3 px-2 text-sm font-medium transition-colors ${
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover-elevate'
                  }`}
                >
                  <Icon className="w-5 h-5" />{mt.label}
                </button>
              );
            })}
          </div>

          <div
            onClick={() => { if (!running) inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); if (!running) setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!running && e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            role="button"
            tabIndex={0}
            data-testid="dropzone-bulk-files"
            className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-sm text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover-elevate'
            } ${running ? 'pointer-events-none opacity-70' : ''}`}
          >
            <Upload className="w-6 h-6" />
            <span className="font-medium">{entry.label}</span>
            <span className="text-xs opacity-80">
              {t('admin.partnerZone.bulkDropHint', { defaultValue: 'Birden fazla dosyayı sürükle bırak ya da seçmek için tıkla' })}
            </span>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept={entry.accept}
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('admin.partnerZone.statusLabel')}:</span>
            <Select value={status} onValueChange={setStatus} disabled={running}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t('admin.partnerZone.draftOption')}</SelectItem>
                <SelectItem value="published">{t('admin.partnerZone.publishedOption')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {items.length > 0 && (
            <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="truncate flex-1">{it.file.name}</span>
                  {it.state === 'pending' && <span className="text-xs text-muted-foreground shrink-0">{humanSize(it.file.size)}</span>}
                  {it.state === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                  {it.state === 'done' && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                  {it.state === 'error' && <span title={it.error} className="shrink-0"><XCircle className="w-4 h-4 text-destructive" /></span>}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">{items.length > 0 ? `${doneCount}/${items.length}` : ''}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={running} onClick={() => { onOpenChange(false); reset(); }}>
                {t('common.cancel')}
              </Button>
              <Button type="button" disabled={running || items.length === 0} onClick={uploadAll}>
                {running ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('admin.partnerZone.uploading')}</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />{t('admin.partnerZone.bulkUploadAction', { defaultValue: 'Hepsini yükle' })} ({items.length})</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
