import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Archive, RotateCcw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { getArchive, restoreFromArchive } from '@/api/archive';
import { useToastStore } from '@/stores/toastStore';
import { useT, formatRelativeTime } from '@/i18n';

interface ArchiveItem {
  id: string;
  title: string;
  archivedAt: string;
  author: { id: string; name: string | null; email: string };
}

interface ArchivePanelProps {
  spaceSlug: string;
  open: boolean;
  onClose: () => void;
  onRestore: () => void;
}

export function ArchivePanel({ spaceSlug, open, onClose, onRestore }: ArchivePanelProps) {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const { addToast } = useToastStore();
  const t = useT();

  useEffect(() => {
    if (open && spaceSlug) {
      setLoading(true);
      getArchive(spaceSlug)
        .then((data) => setItems(data as ArchiveItem[]))
        .catch(() => addToast(t('archive.loadError'), 'error'))
        .finally(() => setLoading(false));
    }
  }, [open, spaceSlug, addToast]);

  const handleRestore = useCallback(async (id: string) => {
    setProcessing(id);
    try {
      await restoreFromArchive(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      addToast(t('archive.pageRestored'), 'success');
      onRestore();
    } catch {
      addToast(t('archive.restoreError'), 'error');
    } finally {
      setProcessing(null);
    }
  }, [addToast, onRestore, t]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Slide-in panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-96 bg-bg-primary border-l border-border-primary shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary">
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-amber-400" />
                <h2 className="font-display font-semibold text-text-primary">{t('archive.title')}</h2>
                {items.length > 0 && (
                  <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="p-6 text-center text-text-muted text-sm">
                  <Archive className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>{t('archive.empty')}</p>
                  <p className="text-xs mt-1">{t('archive.emptyDesc')}</p>
                </div>
              ) : (
                <div className="p-2">
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, x: -20 }}
                        className="px-4 py-3 rounded-lg hover:bg-bg-hover transition-colors mb-1"
                      >
                        <div className="flex items-start gap-3">
                          <FileText className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                              <span>{formatRelativeTime(item.archivedAt)}</span>
                              <span>·</span>
                              <span>{item.author.name || item.author.email}</span>
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="!h-7 !px-2.5 !text-xs gap-1.5"
                                disabled={processing === item.id}
                                onClick={() => handleRestore(item.id)}
                              >
                                <RotateCcw className="h-3 w-3" />
                                {t('archive.restore')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
