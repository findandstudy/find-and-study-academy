/**
 * Supported UI / content languages.
 * The app's primary language is English. Additional languages are listed
 * alphabetically (by English label) per product spec.
 *
 * `flag` is the ISO 3166-1 alpha-2 code consumed by `flag-icons`
 * (e.g. <span class="fi fi-sa" />).
 */
export type LanguageCode =
  | 'en'
  | 'ar'
  | 'zh'
  | 'fr'
  | 'id'
  | 'fa'
  | 'ru'
  | 'es'
  | 'tr';

export interface LanguageMeta {
  code: LanguageCode;
  label: string;       // English label
  nativeLabel: string; // Native label
  flag: string;        // ISO 3166-1 alpha-2 country code for flag-icons
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'en', label: 'English',    nativeLabel: 'English',  flag: 'gb', dir: 'ltr' },
  { code: 'ar', label: 'Arabic',     nativeLabel: 'العربية',  flag: 'sa', dir: 'rtl' },
  { code: 'zh', label: 'Chinese',    nativeLabel: '中文',      flag: 'cn', dir: 'ltr' },
  { code: 'fr', label: 'French',     nativeLabel: 'Français', flag: 'fr', dir: 'ltr' },
  { code: 'id', label: 'Indonesian', nativeLabel: 'Indonesia',flag: 'id', dir: 'ltr' },
  { code: 'fa', label: 'Persian',    nativeLabel: 'فارسی',    flag: 'ir', dir: 'rtl' },
  { code: 'ru', label: 'Russian',    nativeLabel: 'Русский',  flag: 'ru', dir: 'ltr' },
  { code: 'es', label: 'Spanish',    nativeLabel: 'Español',  flag: 'es', dir: 'ltr' },
  { code: 'tr', label: 'Turkish',    nativeLabel: 'Türkçe',   flag: 'tr', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const LANGUAGE_CODES: LanguageCode[] = SUPPORTED_LANGUAGES.map(l => l.code);

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return !!code && (LANGUAGE_CODES as string[]).includes(code);
}

export function getLanguageMeta(code: string | null | undefined): LanguageMeta {
  const found = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return found ?? SUPPORTED_LANGUAGES[0];
}
