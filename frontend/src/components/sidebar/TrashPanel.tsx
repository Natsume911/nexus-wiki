import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, RotateCcw, AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { getTrash, restoreFromTrash, permanentlyDeletePage } from '@/api/trash';
import { useToastStore } from '@/stores/toastStore';
import { useT, formatRelativeTime } from '@/i18n';

interface TrashItem {
  id: string;
  title: string;
  deletedAt: string;
  author: { id: string; name: string | null; email: string };
}

interface TrashPanelProps {
  spaceSlug: string;
  open: boolean;
  onClose: () => void;
  onRestore: () => void;
}

export function TrashPanel({ spaceSlug, open, onClose, onRestore }: TrashPanelProps) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [emptyConfirm, setEmptyConfirm] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const { addToast } = useToastStore();
  const t = useT();

  useEffect(() => {
    if (open && spaceSlug) {
      setLoading(true);
      setDeleteConfirm(null);
      setEmptyConfirm(false);
      getTrash(spaceSlug)
        .then((data) => setItems(data as TrashItem[]))
        .catch(() => addToast(t('trash.loadError'), 'error'))
        .finally(() => setLoading(false));
    }
  }, [open, spaceSlug, addToast]);

  const handleRestore = useCallback(async (id: string) => {
    setProcessing(id);
    try {
      await restoreFromTrash(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      addToast(t('trash.pageRestored'), 'success');
      onRestore();
    } catch {
      addToast(t('trash.pageRestoreError'), 'error');
    } finally {
      setProcessing(null);
    }
  }, [addToast, onRestore]);

  const handlePermanentDelete = useCallback(async (id: string) => {
    setProcessing(id);
    try {
      await permanentlyDeletePage(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setDeleteConfirm(null);
      addToast(t('trash.pageDeletedPermanently'), 'success');
    } catch {
      addToast(t('trash.pageDeleteError'), 'error');
    } finally {
      setProcessing(null);
    }
  }, [addToast]);

  const handleEmptyTrash = useCallback(async () => {
    setProcessing('all');
    try {
      await Promise.all(items.map((item) => permanentlyDeletePage(item.id)));
      setItems([]);
      setEmptyConfirm(false);
      addToast(t('trash.emptied'), 'success');
    } catch {
      addToast(t('trash.emptyError'), 'error');
    } finally {
      setProcessing(null);
    }
  }, [items, addToast]);


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
                <Trash2 className="h-5 w-5 text-red-400" />
                <h2 className="font-display font-semibold text-text-primary">{t('trash.title')}</h2>
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

            {/* Empty trash button */}
            {items.length > 0 && (
              <div className="px-5 py-3 border-b border-border-primary">
                {emptyConfirm ? (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-text-secondary flex-1">{t('trash.emptyConfirm')}</span>
                    <Button
                      variant="danger"
                      size="sm"
                      className="!h-7 !px-2.5 !text-xs"
                      disabled={processing === 'all'}
                      onClick={handleEmptyTrash}
                    >
                      {processing === 'all' ? t('trash.deleting') : t('common.confirm')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!h-7 !px-2 !text-xs"
                      onClick={() => setEmptyConfirm(false)}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-red-400 hover:text-red-300 hover:bg-red-400/10 gap-2"
                    onClick={() => setEmptyConfirm(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('trash.emptyTrash')}
                  </Button>
                )}
              </div>
            )}

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
                  <Trash2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>{t('trash.empty')}</p>
                  <p className="text-xs mt-1">{t('trash.emptyDesc')}</p>
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
                              <span>{formatRelativeTime(item.deletedAt)}</span>
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
                                {t('trash.restore')}
                              </Button>

                              {deleteConfirm === item.id ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    className="!h-7 !px-2 !text-xs"
                                    disabled={processing === item.id}
                                    onClick={() => handlePermanentDelete(item.id)}
                                  >
                                    {t('common.confirm')}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="!h-7 !px-2 !text-xs"
                                    onClick={() => setDeleteConfirm(null)}
                                  >
                                    {t('common.no')}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="!h-7 !px-2.5 !text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 gap-1.5"
                                  onClick={() => setDeleteConfirm(item.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  {t('trash.deletePermanently')}
                                </Button>
                              )}
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
