import { create } from 'zustand';
import type { Locale, TKey, TranslationKey, Translations } from './types';
import it from './locales/it.json';
import en from './locales/en.json';
import sq from './locales/sq.json';

const translations: Record<Locale, Translations> = {
  it: it as Translations,
  en: en as Translations,
  sq: sq as Translations,
};

const LOCALE_MAP: Record<Locale, string> = {
  it: 'it-IT',
  en: 'en-GB',
  sq: 'sq-AL',
};

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'it';
  const stored = localStorage.getItem('nexus-locale') as Locale | null;
  if (stored && translations[stored]) return stored;
  return 'it';
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = params[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TKey, params?: Record<string, string | number>) => string;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: getInitialLocale(),

  setLocale: (locale: Locale) => {
    localStorage.setItem('nexus-locale', locale);
    set({ locale });
  },

  t: (key: TKey, params?: Record<string, string | number>) => {
    const { locale } = get();
    const dict = translations[locale];

    // Pluralization: if params.count exists, try _one/_other suffix
    if (params && 'count' in params) {
      const count = Number(params.count);
      const suffix = count === 1 ? '_one' : '_other';
      const pluralKey = `${key}${suffix}` as TranslationKey;
      if (dict[pluralKey]) {
        return interpolate(dict[pluralKey], params);
      }
    }

    const template = dict[key as TranslationKey];
    if (!template) {
      // Fallback to Italian
      const fallback = translations.it[key as TranslationKey];
      if (fallback) return interpolate(fallback, params);
      return key;
    }
    return interpolate(template, params);
  },
}));

/** Hook that re-renders components when locale changes */
export function useT() {
  // Subscribe to locale so component re-renders when it changes,
  // then return the t function which reads locale dynamically via get()
  useI18nStore((s) => s.locale);
  return useI18nStore.getState().t;
}

/** Hook for current locale code */
export function useLocale() {
  return useI18nStore((s) => s.locale);
}

/** Format a date string using the current locale */
export function formatDate(
  dateStr: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const locale = useI18nStore.getState().locale;
  return new Date(dateStr).toLocaleDateString(LOCALE_MAP[locale], options);
}

/** Format relative time using current locale */
export function formatRelativeTime(dateStr: string): string {
  const t = useI18nStore.getState().t;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return t('time.now');
  if (mins < 60) return t('time.minutesAgo', { count: mins });
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  if (days < 7) return t('time.daysAgo', { count: days });

  return formatDate(dateStr, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
