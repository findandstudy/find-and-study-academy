import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, ChevronRight, Folder, Download, FileText, Video, Image as ImageIcon, File,
  ExternalLink, Search, Home,
} from 'lucide-react';
import { CountryFlag } from '@/components/CountryFlag';

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
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder="Ara..."
          className="pl-9"
          data-testid="input-partner-search"
        />
      </div>
      <Select value={props.country} onValueChange={props.onCountryChange}>
        <SelectTrigger className="w-full sm:w-44" data-testid="select-partner-country">
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
          <SelectTrigger className="w-full sm:w-40" data-testid="select-partner-filetype">
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
        <SelectTrigger className="w-full sm:w-40" data-testid="select-partner-sort">
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

// ─── Folder card ────────────────────────────────────────────────────────────

function FolderCard({
  folder,
  countries,
  onClick,
}: {
  folder: PartnerFolder;
  countries: CountryItem[];
  onClick: () => void;
}) {
  const country = countries.find((c) => c.code === folder.countryCode) ?? null;
  return (
    <button
      onClick={onClick}
      className="group relative rounded-xl overflow-hidden border hover-elevate text-left w-full"
      data-testid={`folder-card-${folder.id}`}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {folder.coverImageUrl ? (
          <img
            src={folder.coverImageUrl}
            alt={folder.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Folder className="w-20 h-20 text-muted-foreground opacity-20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
          <p className="text-white font-semibold text-sm leading-tight drop-shadow-sm line-clamp-2">
            {folder.name}
          </p>
          <div className="flex items-center justify-between gap-2 text-white/85 text-xs">
            {country ? (
              <span className="inline-flex items-center gap-1.5">
                <CountryFlag code={country.code} size="sm" />
                <span className="truncate max-w-[100px]">{country.name}</span>
              </span>
            ) : (
              <span />
            )}
            <span className="inline-flex items-center gap-1 shrink-0">
              {(folder.subfolderCount ?? 0) > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Folder className="w-3 h-3" />
                  {folder.subfolderCount}
                </span>
              )}
              {(folder.contentCount ?? 0) > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <File className="w-3 h-3" />
                  {folder.contentCount}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Content card with dual Aç + İndir buttons ─────────────────────────────

function ContentCard({ item }: { item: FolderContent }) {
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

  return (
    <div
      className="rounded-xl border bg-card overflow-hidden flex flex-col hover-elevate"
      data-testid={`content-card-${item.id}`}
    >
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
            Aç
          </Button>
          <Button
            className="flex-1"
            onClick={handleDownload}
            disabled={!url}
            data-testid={`button-download-${item.id}`}
          >
            <Download className="w-4 h-4 mr-2" />
            İndir
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sorting / filtering helpers ───────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────

export default function AgentPartnerZone() {
  const [, params] = useRoute('/agent/partner-zone/:folderId');
  const [, navigate] = useLocation();
  const folderId = params?.folderId ?? null;

  // Toolbar state — kept in component state. Reset between list ↔ detail views naturally.
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('all');
  const [fileType, setFileType] = useState<FileTypeFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');

  // Active countries (for country select)
  const { data: countriesData } = useQuery<{ countries: CountryItem[] }>({
    queryKey: ['/api/public/countries'],
    queryFn: async () => {
      const r = await fetch('/api/public/countries');
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const countries = (countriesData?.countries ?? []).filter((c) => c.status === 'active');

  // Folder list (root or under a parent — value `parentId=root` for root)
  const listParentParam = folderId ?? 'root';
  const { data: foldersData, isLoading: foldersLoading } = useQuery<{ folders: PartnerFolder[] }>({
    queryKey: ['/api/partner-folders', { parentId: listParentParam }],
    queryFn: async () => {
      const r = await fetch(`/api/partner-folders?parentId=${encodeURIComponent(listParentParam)}`, {
        headers: authHeaders(),
      });
      return r.json();
    },
    enabled: !folderId, // only used on root view
  });

  // Folder detail
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

  // ─── Filtering ───────────────────────────────────────────────────────────

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

  const filteredDetailSubfolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortFolders(
      detailSubfolders.filter((f) => {
        if (country !== 'all' && f.countryCode !== country) return false;
        if (q) {
          const hay = `${f.name} ${f.description ?? ''} ${f.categoryTag ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
      sort,
    );
  }, [detailSubfolders, country, search, sort]);

  const filteredDetailContents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortContents(
      detailContents.filter((c) => {
        if (fileType !== 'all' && getContentType(c) !== fileType) return false;
        if (q) {
          const hay = `${c.title} ${c.description ?? ''} ${c.displayName ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
      sort,
    );
  }, [detailContents, fileType, search, sort]);

  // ─── Folder detail view ───────────────────────────────────────────────────

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
            <span>Yükleniyor...</span>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Subfolders section */}
            {filteredDetailSubfolders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Alt Klasörler
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
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Dosyalar
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredDetailContents.map((item) => (
                    <ContentCard key={item.id} item={item} />
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
                    ? 'Filtrelere uygun klasör veya dosya bulunamadı.'
                    : 'Bu klasörde henüz içerik bulunmuyor.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Root folder list view ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Partner Zone
        </h1>
        <p className="text-muted-foreground mt-2">
          Find And Study Academy tarafından paylaşılan kaynaklar, rehberler ve materyaller.
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
          <span>Yükleniyor...</span>
        </div>
      ) : filteredRootFolders.length === 0 ? (
        <div className="text-center py-20">
          <Folder className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-25" />
          <p className="text-muted-foreground text-lg font-medium">
            {search || country !== 'all' ? 'Eşleşen klasör bulunamadı.' : 'Henüz klasör bulunmuyor'}
          </p>
          {!search && country === 'all' && (
            <p className="text-muted-foreground text-sm mt-1">İçerikler yakında eklenecek.</p>
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
