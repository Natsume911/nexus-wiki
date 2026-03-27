import { Globe } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '@/components/ui/Button';
import { useI18nStore, useLocale } from '@/i18n';
import type { Locale } from '@/i18n/types';

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: 'it', label: 'Italiano', flag: '\ud83c\uddee\ud83c\uddf9' },
  { code: 'en', label: 'English', flag: '\ud83c\uddec\ud83c\udde7' },
  { code: 'sq', label: 'Shqip', flag: '\ud83c\udde6\ud83c\uddf1' },
];

export function LanguageSelector() {
  const locale = useLocale();
  const setLocale = useI18nStore((s) => s.setLocale);
  const current = LANGUAGES.find((l) => l.code === locale)!;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-text-muted"
          aria-label="Language"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{current.flag}</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[140px] rounded-lg border border-border-primary bg-bg-secondary shadow-xl p-1 z-50"
          sideOffset={4}
          align="end"
        >
          {LANGUAGES.map((lang) => (
            <DropdownMenu.Item
              key={lang.code}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none
                ${locale === lang.code
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }`}
              onSelect={() => setLocale(lang.code)}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
