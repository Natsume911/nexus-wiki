import type it from './locales/it.json';

export type TranslationKey = keyof typeof it;
export type Translations = Record<TranslationKey, string>;
export type Locale = 'it' | 'en' | 'sq';

/** Base keys for pluralized entries (e.g., "foo_one" | "foo_other" → "foo") */
type PluralSuffix = '_one' | '_other';
type PluralBaseKey = {
  [K in TranslationKey]: K extends `${infer Base}${PluralSuffix}` ? Base : never;
}[TranslationKey];

/** Keys accepted by t(): literal keys + base plural keys */
export type TKey = TranslationKey | PluralBaseKey;
