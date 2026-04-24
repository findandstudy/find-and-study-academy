import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, Folder, Download, FileText, Video, Image, File, ExternalLink } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PartnerFolder {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  countryCode: string | null;
  categoryTag: string | null;
  status: string;
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

type MediaType = 'document' | 'video' | 'image';

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
  if (type === 'image') return <Image className={className} />;
  return <FileText className={className} />;
}

// ─── Folder card ─────────────────────────────────────────────────────────────

function FolderCard({ folder, onClick }: { folder: PartnerFolder; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative rounded-xl overflow-hidden border hover-elevate text-left w-full"
      data-testid={`folder-card-${folder.id}`}
    >
      {/* Cover */}
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
        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white font-semibold text-sm leading-tight drop-shadow-sm line-clamp-3">
            {folder.name}
          </p>
          {folder.countryCode && (
            <span className="text-white/70 text-xs mt-0.5 block">{folder.countryCode}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Content item card ────────────────────────────────────────────────────────

function ContentCard({ item }: { item: FolderContent }) {
  const url = getContentUrl(item);
  const mt = getContentType(item);

  const handleAction = () => {
    if (!url) return;
    if (mt === 'image' || mt === 'video') {
      window.open(url, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = item.displayName || item.title;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col hover-elevate" data-testid={`content-card-${item.id}`}>
      {/* Image preview (if type is image) */}
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

        <Button
          variant="outline"
          className="w-full mt-auto"
          onClick={handleAction}
          disabled={!url}
        >
          {mt === 'image' || mt === 'video' ? (
            <><ExternalLink className="w-4 h-4 mr-2" />Aç</>
          ) : (
            <><Download className="w-4 h-4 mr-2" />İndir</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AgentPartnerZone() {
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

  // Folder list
  const { data: foldersData, isLoading: foldersLoading } = useQuery<{ success: boolean; folders: PartnerFolder[] }>({
    queryKey: ['/api/partner-folders'],
    queryFn: async () => {
      const res = await fetch('/api/partner-folders', {
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('fas_session') || '{}')?.user?.id || '' },
      });
      return res.json();
    },
  });

  // Folder detail
  const { data: detailData, isLoading: detailLoading } = useQuery<{ success: boolean; folder: PartnerFolder; contents: FolderContent[] }>({
    queryKey: ['/api/partner-folders', openFolderId, 'contents'],
    queryFn: async () => {
      const res = await fetch(`/api/partner-folders/${openFolderId}/contents`, {
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('fas_session') || '{}')?.user?.id || '' },
      });
      return res.json();
    },
    enabled: !!openFolderId,
  });

  const folders = foldersData?.folders ?? [];
  const openFolder = detailData?.folder ?? null;
  const folderContents = detailData?.contents ?? [];

  // ─── Folder detail view ───────────────────────────────────────────────────

  if (openFolderId) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setOpenFolderId(null)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{openFolder?.name ?? '...'}</h1>
            {openFolder?.description && (
              <p className="text-muted-foreground text-sm">{openFolder.description}</p>
            )}
          </div>
        </div>

        {detailLoading ? (
          <div className="flex justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /><span>Yükleniyor...</span>
          </div>
        ) : folderContents.length === 0 ? (
          <div className="text-center py-20">
            <File className="w-14 h-14 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">Bu klasörde henüz içerik bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {folderContents.map(item => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Folder grid view ─────────────────────────────────────────────────────

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

      {/* Folders */}
      {foldersLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /><span>Yükleniyor...</span>
        </div>
      ) : folders.length === 0 ? (
        <div className="text-center py-20">
          <Folder className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-25" />
          <p className="text-muted-foreground text-lg font-medium">Henüz klasör bulunmuyor</p>
          <p className="text-muted-foreground text-sm mt-1">İçerikler yakında eklenecek.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {folders.map(folder => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onClick={() => setOpenFolderId(folder.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
