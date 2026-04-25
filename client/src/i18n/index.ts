import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { DEFAULT_LANGUAGE, LANGUAGE_CODES, getLanguageMeta, isSupportedLanguage } from './languages';

import en from './locales/en/common.json';
import ar from './locales/ar/common.json';
import zh from './locales/zh/common.json';
import fr from './locales/fr/common.json';
import id from './locales/id/common.json';
import fa from './locales/fa/common.json';
import ru from './locales/ru/common.json';
import es from './locales/es/common.json';
import tr from './locales/tr/common.json';

export const I18N_STORAGE_KEY = 'fas_language';

const resources = {
  en: { common: en },
  ar: { common: ar },
  zh: { common: zh },
  fr: { common: fr },
  id: { common: id },
  fa: { common: fa },
  ru: { common: ru },
  es: { common: es },
  tr: { common: tr },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGE_CODES,
    nonExplicitSupportedLngs: true, // map 'en-US' → 'en', 'tr-TR' → 'tr'
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: I18N_STORAGE_KEY,
      caches: ['localStorage'],
    },
    returnEmptyString: false,
  });

// Keep <html lang> and <html dir> in sync with the active language so RTL
// languages (ar, fa) flip the entire layout automatically.
//
// Important: when nonExplicitSupportedLngs is true, i18next may surface a
// regional code like "ar-SA" or "fa-IR" as the active language even though we
// only register the bare codes. Strip the region suffix before lookup so
// regional Arabic/Persian browsers still get RTL.
function normalizeCode(lng: string | undefined | null): string {
  if (!lng) return DEFAULT_LANGUAGE;
  if (isSupportedLanguage(lng)) return lng;
  const base = lng.split('-')[0];
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}

function applyDirection(lng: string) {
  const meta = getLanguageMeta(normalizeCode(lng));
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', meta.code);
    document.documentElement.setAttribute('dir', meta.dir);
  }
}

i18n.on('languageChanged', applyDirection);
applyDirection(i18n.resolvedLanguage || i18n.language || DEFAULT_LANGUAGE);

export default i18n;
