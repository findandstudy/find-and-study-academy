/** Academy languages in the order used by the main Find And Study website. */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: 'gb', dir: 'ltr' },
  { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', flag: 'tr', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', flag: 'sa', dir: 'rtl' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', flag: 'fr', dir: 'ltr' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский', flag: 'ru', dir: 'ltr' },
  { code: 'fa', label: 'Persian', nativeLabel: 'فارسی', flag: 'ir', dir: 'rtl' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文', flag: 'cn', dir: 'ltr' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: 'in', dir: 'ltr' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: 'es', dir: 'ltr' },
  { code: 'id', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', flag: 'id', dir: 'ltr' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', flag: 'pk', dir: 'rtl' },
  { code: 'tk', label: 'Turkmen', nativeLabel: 'Türkmençe', flag: 'tm', dir: 'ltr' },
  { code: 'ky', label: 'Kyrgyz', nativeLabel: 'Кыргызча', flag: 'kg', dir: 'ltr' },
  { code: 'kk', label: 'Kazakh', nativeLabel: 'Қазақша', flag: 'kz', dir: 'ltr' },
  { code: 'uz', label: 'Uzbek', nativeLabel: 'O‘zbekcha', flag: 'uz', dir: 'ltr' },
  { code: 'tg', label: 'Tajik', nativeLabel: 'Тоҷикӣ', flag: 'tj', dir: 'ltr' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', flag: 'bd', dir: 'ltr' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', flag: 'pt', dir: 'ltr' },
  { code: 'ne', label: 'Nepali', nativeLabel: 'नेपाली', flag: 'np', dir: 'ltr' },
  { code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt', flag: 'vn', dir: 'ltr' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어', flag: 'kr', dir: 'ltr' },
  { code: 'uk', label: 'Ukrainian', nativeLabel: 'Українська', flag: 'ua', dir: 'ltr' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano', flag: 'it', dir: 'ltr' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];
export type LanguageMeta = typeof SUPPORTED_LANGUAGES[number];
export const DEFAULT_LANGUAGE: LanguageCode = 'en';
export const LANGUAGE_CODES: LanguageCode[] = SUPPORTED_LANGUAGES.map(language => language.code);

export function isSupportedLanguage(code: unknown): code is LanguageCode {
  return typeof code === 'string' && LANGUAGE_CODES.includes(code as LanguageCode);
}

export function normalizeLanguage(code: string | null | undefined): LanguageCode {
  const base = code?.toLowerCase().split(/[-_]/)[0];
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}

export function getLanguageMeta(code: string | null | undefined): LanguageMeta {
  return SUPPORTED_LANGUAGES.find(language => language.code === normalizeLanguage(code))!;
}
