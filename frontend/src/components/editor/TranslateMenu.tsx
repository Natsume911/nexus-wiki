import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TranslatePreviewModal } from './TranslatePreviewModal';
import { translatePagePreview } from '@/api/ai';
import { useToastStore } from '@/stores/toastStore';
import { useT } from '@/i18n';

const LANGUAGES = [
  { value: 'italian', labelKey: 'translate.lang.italian' as const },
  { value: 'english', labelKey: 'translate.lang.english' as const },
  { value: 'albanian', labelKey: 'translate.lang.albanian' as const },
  { value: 'french', labelKey: 'translate.lang.french' as const },
  { value: 'german', labelKey: 'translate.lang.german' as const },
  { value: 'spanish', labelKey: 'translate.lang.spanish' as const },
  { value: 'portuguese', labelKey: 'translate.lang.portuguese' as const },
];

interface TranslateMenuProps {
  pageId: string;
  onTranslated: () => void;
}

export function TranslateMenu({ pageId, onTranslated }: TranslateMenuProps) {
  const [translating, setTranslating] = useState(false);
  const [pendingLang, setPendingLang] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    content: Record<string, unknown>;
    title: string;
    langLabel: string;
    targetLang: string;
  } | null>(null);
  const { addToast } = useToastStore();
  const t = useT();

  const handleTranslatePreview = async (targetLang: string, langLabel: string) => {
    setTranslating(true);
    setPendingLang(targetLang);
    try {
      const result = await translatePagePreview(pageId, targetLang);
      setPreviewData({ content: result.content, title: result.title, langLabel, targetLang });
    } catch (err: any) {
      addToast(t('translate.error', { message: err.message || '' }), 'error');
    } finally {
      setTranslating(false);
      setPendingLang(null);
    }
  };

  return (
    <>
      {translating ? (
        <Button
          variant="ghost"
          size="sm"
          disabled
          className="!text-xs !h-auto !px-1.5 !py-0.5 text-accent"
        >
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {t('translate.translating')}
        </Button>
      ) : (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="!text-xs !h-auto !px-1.5 !py-0.5 text-text-muted hover:text-text-primary"
            >
              <Globe className="h-3 w-3 mr-1" />
              {t('translate.button')}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[160px] rounded-lg border border-border-primary bg-bg-secondary shadow-xl p-1 z-50"
              sideOffset={4}
            >
              {LANGUAGES.map((lang) => (
                <DropdownMenu.Item
                  key={lang.value}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary rounded-md cursor-pointer hover:bg-bg-hover hover:text-text-primary outline-none"
                  onSelect={() => handleTranslatePreview(lang.value, t(lang.labelKey))}
                  disabled={pendingLang === lang.value}
                >
                  {t(lang.labelKey)}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}

      <TranslatePreviewModal
        open={previewData !== null}
        content={previewData?.content ?? null}
        title={previewData?.title ?? ''}
        langLabel={previewData?.langLabel ?? ''}
        pageId={pageId}
        targetLang={previewData?.targetLang ?? ''}
        onClose={() => setPreviewData(null)}
        onApplied={() => {
          setPreviewData(null);
          onTranslated();
        }}
      />
    </>
  );
}
