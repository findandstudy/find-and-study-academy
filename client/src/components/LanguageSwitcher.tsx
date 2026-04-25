import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Check, Globe } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import {
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  getLanguageMeta,
  type LanguageCode,
} from '@/i18n/languages';

interface LanguageSwitcherProps {
  /**
   * Visual variant.
   * - "compact" (default): icon button — current flag only, intended for header bars.
   * - "inline": flag + native name visible — for empty headers like the public auth screens.
   */
  variant?: 'compact' | 'inline';
  /** Optional extra classes for the trigger button. */
  className?: string;
}

/**
 * Language picker. Persists to localStorage automatically (via i18next-browser-languagedetector)
 * and, for authenticated users, mirrors the choice to the backend so it follows the user
 * across devices on next login.
 */
export function LanguageSwitcher({ variant = 'compact', className }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const { user, updateUser } = useAuthStore();
  const { toast } = useToast();

  const currentCode = (isSupportedLanguage(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : isSupportedLanguage(i18n.language)
      ? i18n.language
      : 'en') as LanguageCode;
  const current = getLanguageMeta(currentCode);

  const handleChange = async (code: LanguageCode) => {
    if (code === currentCode) return;

    await i18n.changeLanguage(code);
    const meta = getLanguageMeta(code);

    toast({
      title: t('toast.languageChanged'),
      description: t('toast.languageChangedDescription', { name: meta.nativeLabel }),
    });

    // Persist on the user record for cross-device sync
    if (user?.id) {
      try {
        const res = await fetch('/api/me/language', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id,
            'x-user-role': user.role,
          },
          body: JSON.stringify({ languagePreference: code }),
        });
        if (res.ok) {
          updateUser({ languagePreference: code });
        }
      } catch (err) {
        // Local change still applies via localStorage even if the network call fails
        console.error('Failed to persist language preference:', err);
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === 'compact' ? 'icon' : 'sm'}
          className={className}
          aria-label={t('language.select')}
          data-testid="button-language-switcher"
          title={t('language.current', { name: current.nativeLabel })}
        >
          {variant === 'compact' ? (
            <span className="inline-flex items-center justify-center">
              <span className={`fi fi-${current.flag}`} aria-hidden="true" />
              <Globe className="h-4 w-4 ml-1 opacity-60" aria-hidden="true" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className={`fi fi-${current.flag}`} aria-hidden="true" />
              <span className="text-sm font-medium">{current.nativeLabel}</span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = lang.code === currentCode;
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleChange(lang.code)}
              data-testid={`menuitem-language-${lang.code}`}
              className="gap-3"
            >
              <span className={`fi fi-${lang.flag}`} aria-hidden="true" />
              <span className="flex-1">{lang.nativeLabel}</span>
              {isActive && <Check className="h-4 w-4 opacity-70" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
