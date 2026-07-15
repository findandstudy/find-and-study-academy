import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import {
  Plus, Trash2, Upload, ArrowUp, ArrowDown, Loader2, Save, Link2, ExternalLink,
} from 'lucide-react';

interface LinkItem {
  id: string;
  label: string;
  url: string;
  iconUrl: string | null;
  order: number;
  enabled: boolean;
}

export default function SidebarLinks() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputs = useRef<Array<HTMLInputElement | null>>([]);

  const T = (k: string, dflt: string) => t(`admin.sidebarLinks.${k}`, { defaultValue: dflt });

  useEffect(() => {
    (async () => {
      try {
        const r = await apiRequest('GET', '/api/admin/sidebar-links');
        const j = await r.json();
        setLinks((j.links ?? []).map((l: LinkItem, i: number) => ({ ...l, order: i })));
      } catch {
        toast({ title: t('common.error'), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (i: number, patch: Partial<LinkItem>) =>
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLink = () =>
    setLinks((prev) => [
      ...prev,
      { id: `link-${Date.now()}`, label: '', url: '', iconUrl: null, order: prev.length, enabled: true },
    ]);

  const removeLink = (i: number) => setLinks((prev) => prev.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    setLinks((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((l, idx) => ({ ...l, order: idx }));
    });
  };

  const uploadIcon = async (i: number, file: File) => {
    setUploadingIndex(i);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'images');
      const res = await fetch('/api/uploads/content', {
        method: 'POST',
        headers: { 'x-user-id': user?.id ?? '', 'x-user-role': user?.role ?? '' },
        body: fd,
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const url = data?.url || data?.fileUrl || data?.path;
      if (!url) throw new Error('no url');
      update(i, { iconUrl: url });
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' });
    } finally {
      setUploadingIndex(null);
    }
  };

  const save = async () => {
    // basic validation: every row needs a label + url
    const invalid = links.some((l) => !l.label.trim() || !l.url.trim());
    if (invalid) {
      toast({ title: T('validationTitle', 'Missing fields'), description: T('validationDesc', 'Every link needs a name and a URL.'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = links.map((l, i) => ({ ...l, order: i }));
      const r = await apiRequest('PUT', '/api/admin/sidebar-links', { links: payload });
      const j = await r.json();
      if (!r.ok || j.success === false) throw new Error();
      setLinks((j.links ?? payload).map((l: LinkItem, i: number) => ({ ...l, order: i })));
      toast({ title: T('savedTitle', 'Saved'), description: T('savedDesc', 'Sidebar links updated.') });
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6" />{T('title', 'Sidebar Links')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {T('description', 'Manage the links shown in the agent sidebar. They open in a new tab.')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addLink} data-testid="button-add-link">
            <Plus className="w-4 h-4 mr-2" />{T('addLink', 'Add link')}
          </Button>
          <Button onClick={save} disabled={saving} data-testid="button-save-links">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {t('common.save')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /><span>{t('common.loading', { defaultValue: 'Loading...' })}</span>
        </div>
      ) : links.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            <Link2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            {T('empty', 'No links yet. Click “Add link” to create one.')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map((l, i) => (
            <Card key={l.id} data-testid={`link-row-${i}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 pt-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)} title={T('moveUp', 'Move up')}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === links.length - 1} onClick={() => move(i, 1)} title={T('moveDown', 'Move down')}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputs.current[i]?.click()}
                      className="w-14 h-14 rounded-md border bg-muted flex items-center justify-center overflow-hidden hover-elevate"
                      title={T('uploadIcon', 'Upload icon')}
                      data-testid={`button-upload-icon-${i}`}
                    >
                      {uploadingIndex === i ? (
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      ) : l.iconUrl ? (
                        <img src={l.iconUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <Upload className="w-5 h-5 text-muted-foreground opacity-60" />
                      )}
                    </button>
                    <input
                      ref={(el) => (fileInputs.current[i] = el)}
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg,.webp,.gif"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadIcon(i, f); e.target.value = ''; }}
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <Input
                      value={l.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder={T('namePlaceholder', 'Display name (e.g. Agent Portal)')}
                      data-testid={`input-label-${i}`}
                    />
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Input
                        value={l.url}
                        onChange={(e) => update(i, { url: e.target.value })}
                        placeholder="https://..."
                        data-testid={`input-url-${i}`}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer w-fit">
                      <Checkbox checked={l.enabled} onCheckedChange={(v) => update(i, { enabled: v === true })} data-testid={`checkbox-enabled-${i}`} />
                      {T('enabled', 'Visible to agents')}
                    </label>
                  </div>

                  <Button size="icon" variant="ghost" onClick={() => removeLink(i)} title={t('common.delete')} data-testid={`button-remove-link-${i}`}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
