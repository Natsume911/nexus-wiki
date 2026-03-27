import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  const t = useT();

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
          <div className="flex items-start gap-3">
            {variant === 'danger' && (
              <div className="shrink-0 mt-0.5 p-2 rounded-full bg-error/10">
                <AlertTriangle className="h-4 w-4 text-error" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-base font-semibold font-display text-text-primary">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 text-sm text-text-secondary leading-relaxed">
                {description}
              </Dialog.Description>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-5">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                {cancelLabel || t('common.cancel')}
              </Button>
            </Dialog.Close>
            <Button
              variant={variant === 'danger' ? 'danger' : 'default'}
              size="sm"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel || t('common.confirm')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
