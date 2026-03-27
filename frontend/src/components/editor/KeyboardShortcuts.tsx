import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';

interface ShortcutItem {
  keys: string[];
  labelKey: TranslationKey;
}

interface ShortcutCategory {
  titleKey: TranslationKey;
  shortcuts: ShortcutItem[];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? '\u2318' : 'Ctrl';
const shiftKey = isMac ? '\u21e7' : 'Shift';

const CATEGORIES: ShortcutCategory[] = [
  {
    titleKey: 'shortcut.cat.navigation' as const,
    shortcuts: [
      { keys: [modKey, 'K'], labelKey: 'shortcut.search' as const },
      { keys: ['?'], labelKey: 'shortcut.shortcuts' as const },
    ],
  },
  {
    titleKey: 'shortcut.cat.editor' as const,
    shortcuts: [
      { keys: [modKey, 'B'], labelKey: 'shortcut.bold' as const },
      { keys: [modKey, 'I'], labelKey: 'shortcut.italic' as const },
      { keys: [modKey, 'U'], labelKey: 'shortcut.underline' as const },
      { keys: [modKey, shiftKey, 'X'], labelKey: 'shortcut.strikethrough' as const },
      { keys: [modKey, 'E'], labelKey: 'shortcut.inlineCode' as const },
      { keys: [modKey, shiftKey, 'H'], labelKey: 'shortcut.highlight' as const },
    ],
  },
  {
    titleKey: 'shortcut.cat.blocks' as const,
    shortcuts: [
      { keys: [modKey, shiftKey, '1'], labelKey: 'shortcut.heading1' as const },
      { keys: [modKey, shiftKey, '2'], labelKey: 'shortcut.heading2' as const },
      { keys: [modKey, shiftKey, '3'], labelKey: 'shortcut.heading3' as const },
      { keys: ['/'], labelKey: 'shortcut.commandMenu' as const },
    ],
  },
  {
    titleKey: 'shortcut.cat.page' as const,
    shortcuts: [
      { keys: [modKey, 'E'], labelKey: 'shortcut.editToggle' as const },
      { keys: [modKey, shiftKey, 'F'], labelKey: 'shortcut.favorite' as const },
      { keys: [modKey, shiftKey, 'W'], labelKey: 'shortcut.watch' as const },
      { keys: [modKey, shiftKey, 'H'], labelKey: 'shortcut.history' as const },
      { keys: [modKey, shiftKey, 'L'], labelKey: 'shortcut.readingMode' as const },
    ],
  },
  {
    titleKey: 'shortcut.cat.actions' as const,
    shortcuts: [
      { keys: [modKey, 'S'], labelKey: 'shortcut.save' as const },
      { keys: [modKey, 'Z'], labelKey: 'shortcut.undo' as const },
      { keys: [modKey, shiftKey, 'Z'], labelKey: 'shortcut.redo' as const },
    ],
  },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const t = useT();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only trigger on '?' when not in an input/textarea/editor
    if (e.key !== '?') return;

    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const isEditable = target.isContentEditable;
    const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';

    if (isInput || isEditable) return;

    e.preventDefault();
    setOpen(true);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-primary bg-bg-secondary p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <Keyboard className="h-4.5 w-4.5" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold font-display text-text-primary">
                  {t('shortcut.title')}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-text-muted">
                  {t('shortcut.description')}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Shortcut categories */}
          <div className="space-y-5">
            {CATEGORIES.map((category) => (
              <div key={category.titleKey}>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2.5">
                  {t(category.titleKey)}
                </h3>
                <div className="space-y-1">
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.labelKey}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-bg-hover transition-colors"
                    >
                      <span className="text-sm text-text-secondary">{t(shortcut.labelKey)}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <span className="text-text-muted text-xs">+</span>}
                            <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-bg-tertiary border border-border-primary text-xs font-mono text-text-primary shadow-sm">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-border-primary">
            <p className="text-xs text-text-muted text-center">
              {t('shortcut.footer')}
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
