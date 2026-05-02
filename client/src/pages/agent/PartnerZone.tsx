import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, ChevronRight, Folder, Download, FileText, Video, Image as ImageIcon, File,
  ExternalLink, Search, Home, X, Archive,
} from 'lucide-react';
import { CountryFlag } from '@/components/CountryFlag';
import { useTranslation } from 'react-i18next';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PartnerFolder {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  countryCode: string | null;
  categoryTag: string | null;
  status: string;
  parentFolderId: string | null;
  subfolderCount?: number;
  contentCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface FolderContent {
  id: string;
  title: string;
  description: string | null;
  contentType: string | null;
  type: string;
  documentUrl: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  displayName: string | null;
  fileSize: string | null;
  folderId?: string | null;
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

function MediaIcon({ type, className }: { type: MediaType; className?: string }) {
  if (type === 'video') return <Video className={className} />;
  if (type === 'image') return <ImageIcon className={className} />;
  return <FileText className={className} />;
}

// ─── Auth header helper ────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  try {
    const session = JSON.parse(localStorage.getItem('fas_session') || '{}');
    return { 'x-user-id': session?.user?.id ?? '' };
  } catch {
    return {};
  }
}

// ─── Toolbar (shared between folder list and folder detail) ────────────────

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

function PartnerZoneToolbar(props: ToolbarProps) {
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
          placeholder={t('agent.partnerZone.searchPlaceholder')}
          className="pl-9"
          data-testid="input-partner-search"
        />
      </div>
      <Select value={props.country} onValueChange={props.onCountryChange}>
        <SelectTrigger className="w-full sm:w-44" data-testid="select-partner-country">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="all">{t('agent.partnerZone.allCountries')}</SelectItem>
          {props.countries.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="inline-flex items-center gap-2">
                <CountryFlag code={c.code} size="sm" />
                {c.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {props.showFileType && props.onFileTypeChange && (
        <Select value={props.fileType ?? 'all'} onValueChange={(v) => props.onFileTypeChange?.(v as FileTypeFilter)}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-partner-filetype">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('agent.partnerZone.allTypes')}</SelectItem>
            <SelectItem value="document">{t('common.document')}</SelectItem>
            <SelectItem value="video">{t('common.video')}</SelectItem>
            <SelectItem value="image">{t('common.image')}</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Select value={props.sort} onValueChange={(v) => props.onSortChange(v as SortKey)}>
        <SelectTrigger className="w-full sm:w-40" data-testid="select-partner-sort">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">{t('agent.partnerZone.newestFirst')}</SelectItem>
          <SelectItem value="oldest">{t('agent.partnerZone.oldestFirst')}</SelectItem>
          <SelectItem value="az">A → Z</SelectItem>
          <SelectItem value="za">Z → A</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Folder card ─────────────────────────────────────────────────────────────

interface FolderCardProps {
  folder: PartnerFolder;
  countries: CountryItem[];
  onClick: () => void;
}

function FolderCard({ folder: f, countries, onClick }: FolderCardProps) {
  const country = countries.find((c) => c.code === f.countryCode) ?? null;
  return (
    <button
      type="button"
      className="rounded-xl border overflow-hidden text-left w-full hover-elevate"
      onClick={onClick}
      data-testid={`folder-card-${f.id}`}
    >
      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {f.coverImageUrl ? (
          <img src={f.coverImageUrl} alt={f.name} className="w-full h-full object-cover" />
        ) : (
          <Folder className="w-16 h-16 text-muted-foreground opacity-20" />
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="font-semibold text-sm leading-tight line-clamp-2">{f.name}</p>
        <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
          {country ? (
            <span className="inline-flex items-center gap-1.5 truncate">
              <CountryFlag code={country.code} size="sm" />
              <span className="truncate">{country.name}</span>
            </span>
          ) : (
            <span />
          )}
          {(f.contentCount ?? 0) > 0 && (
            <span className="shrink-0 inline-flex items-center gap-0.5">
              <File className="w-3 h-3" />
              {f.contentCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Content card with dual Open + Download buttons ──────────────────────────

interface ContentCardProps {
  item: FolderContent;
  index: number;
  isSelected: boolean;
  onSelectClick: (id: string, index: number, e: React.MouseEvent) => void;
}

function ContentCard({ item, index, isSelected, onSelectClick }: ContentCardProps) {
  const { t } = useTranslation();
  const url = getContentUrl(item);
  const mt = getContentType(item);

  const handleOpen = () => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = item.displayName || item.title;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      onSelectClick(item.id, index, e);
    }
  };

  return (
    <div
      className={`relative rounded-xl border bg-card overflow-hidden flex flex-col hover-elevate ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={handleCardClick}
      data-state={isSelected ? 'selected' : undefined}
      data-testid={`content-card-${item.id}`}
    >
      <div
        className="absolute top-2 left-2 z-10 rounded bg-background/90 p-1 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onClick={(e) => {
            e.stopPropagation();
            onSelectClick(item.id, index, e);
          }}
          aria-label={`${item.displayName || item.title}`}
          data-testid={`checkbox-content-${item.id}`}
        />
      </div>

      {mt === 'image' && url && (
        <div className="aspect-video overflow-hidden bg-muted">
          <img src={url} alt={item.displayName || item.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <MediaIcon type={mt} className="w-6 h-6 text-primary opacity-70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">{item.displayName || item.title}</p>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
            )}
            {item.fileSize && (
              <p className="text-xs text-muted-foreground/70 mt-1">{item.fileSize}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-auto">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleOpen}
            disabled={!url}
            data-testid={`button-open-${item.id}`}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('agent.partnerZone.openFile')}
          </Button>
          <Button
            className="flex-1"
            onClick={handleDownload}
            disabled={!url}
            data-testid={`button-download-${item.id}`}
          >
            <Download className="w-4 h-4 mr-2" />
            {t('agent.partnerZone.downloadFile')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sorting / filtering helpers ─────────────────────────────────────────────

function sortFolders(list: PartnerFolder[], sort: SortKey): PartnerFolder[] {
  const arr = [...list];
  arr.sort((a, b) => {
    if (sort === 'az') return a.name.localeCompare(b.name, 'tr');
    if (sort === 'za') return b.name.localeCompare(a.name, 'tr');
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
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

// ─── Main component ──────────────────────────────────────────────────────────

export default function AgentPartnerZone() {
  const { t } = useTranslation();
  const [, params] = useRoute('/agent/partner-zone/:folderId');
  const [, navigate] = useLocation();
  const folderId = params?.folderId ?? null;

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('all');
  const [fileType, setFileType] = useState<FileTypeFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const zipAbortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setSelectedIds(new Set());
    setLastClickedIndex(null);
    return () => {
      zipAbortRef.current?.abort();
      zipAbortRef.current = null;
    };
  }, [folderId]);

  const { data: countriesData } = useQuery<{ countries: CountryItem[] }>({
    queryKey: ['/api/public/countries'],
    queryFn: async () => {
      const r = await fetch('/api/public/countries');
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const countries = (countriesData?.countries ?? []).filter((c) => c.status === 'active');

  const listParentParam = folderId ?? 'root';
  const { data: foldersData, isLoading: foldersLoading } = useQuery<{ folders: PartnerFolder[] }>({
    queryKey: ['/api/partner-folders', { parentId: listParentParam }],
    queryFn: async () => {
      const r = await fetch(`/api/partner-folders?parentId=${encodeURIComponent(listParentParam)}`, {
        headers: authHeaders(),
      });
      return r.json();
    },
    enabled: !folderId,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery<{
    folder: PartnerFolder;
    contents: FolderContent[];
    subfolders: PartnerFolder[];
    breadcrumb: PartnerFolder[];
  }>({
    queryKey: ['/api/partner-folders', folderId, 'contents'],
    queryFn: async () => {
      const r = await fetch(`/api/partner-folders/${folderId}/contents`, {
        headers: authHeaders(),
      });
      return r.json();
    },
    enabled: !!folderId,
  });

  const rootFolders = foldersData?.folders ?? [];
  const detailFolder = detailData?.folder ?? null;
  const detailSubfolders = detailData?.subfolders ?? [];
  const detailContents = detailData?.contents ?? [];
  const breadcrumb = detailData?.breadcrumb ?? [];

  // ─── Filtering ─────────────────────────────────────────────────────────────

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

  const filteredDetailSubfolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortFolders(
      detailSubfolders.filter((f) => {
        if (q && !f.name.toLowerCase().includes(q)) return false;
        if (country !== 'all' && f.countryCode !== country) return false;
        return true;
      }),
      sort,
    );
  }, [detailSubfolders, search, country, sort]);

  const filteredDetailContents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortContents(
      detailContents.filter((item) => {
        const name = (item.displayName ?? item.title).toLowerCase();
        if (q && !name.includes(q)) return false;
        if (fileType !== 'all' && getContentType(item) !== fileType) return false;
        return true;
      }),
      sort,
    );
  }, [detailContents, search, fileType, sort]);

  // ─── Selection helpers ─────────────────────────────────────────────────────

  const handleSelectClick = (id: string, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndex !== null) {
      const min = Math.min(lastClickedIndex, index);
      const max = Math.max(lastClickedIndex, index);
      const range = filteredDetailContents.slice(min, max + 1).map((item) => item.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        range.forEach((rid) => next.add(rid));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastClickedIndex(index);
    }
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredDetailContents.forEach((item) => next.add(item.id));
      return next;
    });
    setLastClickedIndex(null);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setLastClickedIndex(null);
  };

  // ─── ZIP download ──────────────────────────────────────────────────────────

  const downloadFolderZip = async (mode: 'all' | 'selection') => {
    if (isZipping) return;
    const ids = mode === 'selection' ? Array.from(selectedIds) : [];
    setIsZipping(true);
    const controller = new AbortController();
    zipAbortRef.current = controller;
    try {
      const qs = mode === 'selection' ? `ids=${ids.join(',')}` : '';
      const r = await fetch(
        `/api/partner-folders/${folderId}/zip?${qs}`,
        { headers: authHeaders(), signal: controller.signal },
      );
      if (!r.ok) {
        let msg = t('agent.partnerZone.downloadFailed');
        try {
          const ct = r.headers.get('content-type') ?? '';
          if (ct.includes('application/json')) {
            const j = await r.json();
            if (j?.message) msg = j.message;
          }
        } catch { /* ignore */ }
        toast({ title: t('agent.partnerZone.downloadFailed'), description: msg, variant: 'destructive' });
        return;
      }
      const blob = await r.blob();
      const cd = r.headers.get('content-disposition') ?? '';
      const m = /filename="?([^";]+)"?/i.exec(cd);
      const filename = m?.[1] ?? `${detailFolder?.name ?? 'partner-zone'}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: t('agent.partnerZone.downloadOk'),
        description: mode === 'selection'
          ? t('agent.partnerZone.downloadOkSelected', { count: ids.length })
          : t('agent.partnerZone.downloadOkAll'),
      });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      toast({
        title: t('agent.partnerZone.downloadFailed'),
        description: t('agent.partnerZone.downloadError'),
        variant: 'destructive',
      });
    } finally {
      setIsZipping(false);
      zipAbortRef.current = null;
    }
  };
  const downloadSelectedZip = () => downloadFolderZip('selection');
  const downloadFullFolderZip = () => downloadFolderZip('all');

  const downloadableContentCount = useMemo(
    () => detailContents.filter((c) => {
      const url = c.documentUrl ?? c.imageUrl ?? c.videoUrl ?? null;
      return !!url && url.startsWith('/uploads/');
    }).length,
    [detailContents],
  );

  // ─── Folder detail view ────────────────────────────────────────────────────

  if (folderId) {
    return (
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Breadcrumb">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => navigate('/agent/partner-zone')}
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
                    onClick={() => navigate(`/agent/partner-zone/${b.id}`)}
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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{detailFolder?.name ?? '...'}</h1>
            {detailFolder?.description && (
              <p className="text-muted-foreground text-sm mt-1">{detailFolder.description}</p>
            )}
          </div>
          {downloadableContentCount > 0 && (
            <Button
              onClick={downloadFullFolderZip}
              disabled={isZipping}
              data-testid="button-download-full-folder-zip"
            >
              {isZipping ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Archive className="w-4 h-4 mr-1.5" />
              )}
              {isZipping ? t('agent.partnerZone.preparing') : t('agent.partnerZone.downloadZip')}
            </Button>
          )}
        </div>

        {/* Toolbar */}
        <PartnerZoneToolbar
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
          <div className="flex justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{t('agent.partnerZone.loading')}</span>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Subfolders section */}
            {filteredDetailSubfolders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('agent.partnerZone.subfolders')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredDetailSubfolders.map((f) => (
                    <FolderCard
                      key={f.id}
                      folder={f}
                      countries={countries}
                      onClick={() => navigate(`/agent/partner-zone/${f.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Contents section */}
            {filteredDetailContents.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('common.files')}
                  </h2>
                  {selectedIds.size > 0 ? (
                    <div
                      className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1"
                      data-testid="bulk-selection-toolbar"
                    >
                      <Badge variant="secondary" data-testid="bulk-selection-count">
                        {t('agent.partnerZone.filesSelected', { count: selectedIds.size })}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={downloadSelectedZip}
                        disabled={isZipping}
                        data-testid="button-download-zip"
                      >
                        {isZipping ? (
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        ) : (
                          <Archive className="w-4 h-4 mr-1.5" />
                        )}
                        {isZipping ? t('agent.partnerZone.preparing') : t('agent.partnerZone.downloadSelected')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearSelection}
                        disabled={isZipping}
                        data-testid="button-clear-selection"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        {t('agent.partnerZone.clearSelection')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={selectAllVisible}
                      data-testid="button-select-all-visible"
                    >
                      {t('agent.partnerZone.selectAll')}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredDetailContents.map((item, index) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      index={index}
                      isSelected={selectedIds.has(item.id)}
                      onSelectClick={handleSelectClick}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {filteredDetailSubfolders.length === 0 && filteredDetailContents.length === 0 && (
              <div className="text-center py-20">
                <File className="w-14 h-14 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground">
                  {search || country !== 'all' || fileType !== 'all'
                    ? t('agent.partnerZone.noContentFiltered')
                    : t('agent.partnerZone.noContent')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Root folder list view ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Partner Zone
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('agent.partnerZone.subtitle')}
        </p>
      </div>

      {/* Toolbar */}
      <PartnerZoneToolbar
        search={search}
        onSearchChange={setSearch}
        country={country}
        onCountryChange={setCountry}
        countries={countries}
        sort={sort}
        onSortChange={setSort}
      />

      {/* Folders */}
      {foldersLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t('agent.partnerZone.loading')}</span>
        </div>
      ) : filteredRootFolders.length === 0 ? (
        <div className="text-center py-20">
          <Folder className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-25" />
          <p className="text-muted-foreground text-lg font-medium">
            {search || country !== 'all'
              ? t('agent.partnerZone.noFoldersFiltered')
              : t('agent.partnerZone.noFolders')}
          </p>
          {!search && country === 'all' && (
            <p className="text-muted-foreground text-sm mt-1">{t('agent.partnerZone.comingSoon')}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredRootFolders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              countries={countries}
              onClick={() => navigate(`/agent/partner-zone/${folder.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
