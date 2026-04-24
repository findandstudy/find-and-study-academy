import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/auth';
import { ExternalLink } from 'lucide-react';

interface Popup {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkText: string | null;
  frequency: 'every_session' | 'every_login' | 'once_per_user';
}

const SESSION_KEY = 'fas_popups_seen_session'; // every_session
const LOGIN_KEY = 'fas_popups_seen_login'; // every_login

function readSet(key: string, storage: Storage): Set<string> {
  try {
    const raw = storage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function writeSet(key: string, storage: Storage, set: Set<string>) {
  storage.setItem(key, JSON.stringify(Array.from(set)));
}

export function PopupRenderer() {
  const { user, role } = useAuthStore();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [open, setOpen] = useState(false);

  // Only show pop-ups to agents (not admins/staff) and only on agent dashboard area
  const isAgent = !!user && role === 'agent';
  const onAgentArea = typeof window !== 'undefined' && window.location.pathname.startsWith('/agent');

  const { data } = useQuery<{ success: boolean; popups: Popup[] }>({
    queryKey: ['/api/popups/active'],
    enabled: isAgent && onAgentArea,
  });

  const visiblePopup = useMemo<Popup | null>(() => {
    if (!data?.popups?.length) return null;
    const sessionSeen = readSet(SESSION_KEY, sessionStorage);
    const loginSeen = readSet(LOGIN_KEY, sessionStorage);
    const next = data.popups.find((p) => {
      if (p.frequency === 'every_session' && sessionSeen.has(p.id)) return false;
      if (p.frequency === 'every_login' && loginSeen.has(p.id)) return false;
      return true;
    });
    return next ?? null;
  }, [data]);

  useEffect(() => {
    if (visiblePopup) {
      setDontShowAgain(false);
      setOpen(true);
    }
  }, [visiblePopup?.id]);

  const handleClose = async (open: boolean) => {
    if (open || !visiblePopup) {
      setOpen(open);
      return;
    }
    setOpen(false);

    // Track local frequency
    if (visiblePopup.frequency === 'every_session') {
      const set = readSet(SESSION_KEY, sessionStorage);
      set.add(visiblePopup.id);
      writeSet(SESSION_KEY, sessionStorage, set);
    } else if (visiblePopup.frequency === 'every_login') {
      const set = readSet(LOGIN_KEY, sessionStorage);
      set.add(visiblePopup.id);
      writeSet(LOGIN_KEY, sessionStorage, set);
    }

    // Persist server-side dismissal (always — once_per_user uses dontShowAgain semantics)
    try {
      await apiRequest('POST', `/api/popups/${visiblePopup.id}/dismiss`, {
        dontShowAgain: dontShowAgain || visiblePopup.frequency === 'once_per_user',
      });
    } catch (e) {
      console.error('Popup dismiss failed:', e);
    } finally {
      queryClient.invalidateQueries({ queryKey: ['/api/popups/active'] });
    }
  };

  if (!visiblePopup) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" data-testid={`dialog-popup-${visiblePopup.id}`}>
        <DialogHeader>
          <DialogTitle data-testid="text-popup-title">{visiblePopup.title}</DialogTitle>
          <DialogDescription className="sr-only">Duyuru pop-up</DialogDescription>
        </DialogHeader>

        {visiblePopup.imageUrl && (
          <div className="rounded-md overflow-hidden border border-border">
            <img
              src={visiblePopup.imageUrl}
              alt={visiblePopup.title}
              className="w-full h-auto object-cover max-h-64"
              data-testid="img-popup"
            />
          </div>
        )}

        <div
          className="text-sm text-foreground whitespace-pre-wrap leading-relaxed"
          data-testid="text-popup-content"
        >
          {visiblePopup.content}
        </div>

        {visiblePopup.linkUrl && (
          <a
            href={visiblePopup.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
            data-testid="link-popup-cta"
          >
            <Button size="sm">
              {visiblePopup.linkText || 'Daha fazla bilgi'}
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </a>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
          {visiblePopup.frequency !== 'once_per_user' ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Checkbox
                checked={dontShowAgain}
                onCheckedChange={(v) => setDontShowAgain(!!v)}
                data-testid="checkbox-dont-show-again"
              />
              Bir daha gösterme
            </label>
          ) : (
            <span />
          )}
          <Button variant="outline" onClick={() => handleClose(false)} data-testid="button-popup-close">
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
