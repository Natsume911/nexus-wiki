import slugifyPkg from 'slugify';

// Handle ESM/CJS interop
const slugify = ((slugifyPkg as unknown as Record<string, unknown>).default ?? slugifyPkg) as unknown as (str: string, opts?: Record<string, unknown>) => string;

export function createSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true,
    locale: 'it',
  });
}
