import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
}

export function PromptDialog({
  open,
  onOpenChange,
  title,
  label,
  placeholder,
  defaultValue = '',
  confirmLabel,
  cancelLabel,
  onConfirm,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      // Focus the input after a tick (after radix finishes mounting)
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-border-primary bg-bg-secondary p-6 shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <Dialog.Title className="text-base font-semibold font-display text-text-primary">
            {title}
          </Dialog.Title>
          <form onSubmit={handleSubmit} className="mt-4">
            <label className="block text-sm text-text-secondary mb-1.5">{label}</label>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="sm">
                  {cancelLabel || t('common.cancel')}
                </Button>
              </Dialog.Close>
              <Button type="submit" size="sm" disabled={!value.trim()}>
                {confirmLabel || t('common.confirm')}
              </Button>
            </div>
          </form>
          <Dialog.Close
            className="absolute right-4 top-4 rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
