import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { getTemplates } from '@/api/templates';
import { useToastStore } from '@/stores/toastStore';
import { useT } from '@/i18n';

interface Template {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  content: unknown;
}

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: { title: string; content: unknown }) => void;
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1 },
};

export function TemplatePicker({ open, onOpenChange, onSelect }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const { addToast } = useToastStore();
  const t = useT();

  useEffect(() => {
    if (open) {
      setLoading(true);
      getTemplates()
        .then((data) => setTemplates(data as Template[]))
        .catch(() => addToast(t('template.loadError'), 'error'))
        .finally(() => setLoading(false));
    }
  }, [open, addToast]);

  const handleSelect = (template: Template) => {
    setSelecting(template.id);
    onSelect({ title: template.title, content: template.content });
    setTimeout(() => {
      setSelecting(null);
      onOpenChange(false);
    }, 150);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-primary bg-bg-secondary shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary shrink-0">
            <div>
              <Dialog.Title className="text-lg font-semibold font-display text-text-primary">
                {t('template.title')}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-text-secondary mt-0.5">
                {t('template.description')}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-lg" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('template.noTemplates')}</p>
                <p className="text-xs mt-1">{t('template.noTemplatesDesc')}</p>
              </div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 gap-3"
              >
                {templates.map((template) => (
                  <motion.button
                    key={template.id}
                    variants={staggerItem}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(template)}
                    disabled={selecting !== null}
                    className="flex flex-col items-start p-4 rounded-lg border border-border-primary bg-bg-primary hover:bg-bg-hover hover:border-border-secondary transition-colors text-left group relative"
                  >
                    {selecting === template.id && (
                      <div className="absolute inset-0 bg-accent/10 rounded-lg flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-accent animate-spin" />
                      </div>
                    )}
                    <span className="text-2xl mb-2">{template.icon || '\ud83d\udcdd'}</span>
                    <h4 className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors line-clamp-1">
                      {template.title}
                    </h4>
                    {template.description && (
                      <p className="text-xs text-text-muted mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Footer - blank page option */}
          <div className="px-6 py-4 border-t border-border-primary shrink-0">
            <button
              onClick={() => {
                onSelect({ title: t('common.untitled'), content: {} });
                onOpenChange(false);
              }}
              className="w-full text-center text-sm text-text-muted hover:text-text-secondary transition-colors py-2"
            >
              {t('template.blankPage')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
