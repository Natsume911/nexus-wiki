import { useState, useEffect, useCallback, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Trash2, Upload, Copy, FileText, File } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getAttachments, uploadFile, deleteAttachment } from '@/api/attachments';
import { useToastStore } from '@/stores/toastStore';
import { useT } from '@/i18n';
import type { Attachment } from '@/types';

interface MediaManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceSlug: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function MediaManager({ open, onOpenChange, spaceSlug }: MediaManagerProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToastStore();
  const t = useT();

  useEffect(() => {
    if (open && spaceSlug) {
      setLoading(true);
      getAttachments(spaceSlug)
        .then(setAttachments)
        .catch(() => addToast(t('common.error'), 'error'))
        .finally(() => setLoading(false));
    }
  }, [open, spaceSlug, addToast]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(spaceSlug, file);
      }
      // Refresh list
      const updated = await getAttachments(spaceSlug);
      setAttachments(updated);
      addToast(`${files.length} file caricati`, 'success');
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [spaceSlug, addToast]);

  const confirmDeleteFile = useCallback(async () => {
    if (!deleteTargetId) return;
    try {
      await deleteAttachment(deleteTargetId);
      setAttachments((prev) => prev.filter((a) => a.id !== deleteTargetId));
      addToast(t('common.delete'), 'success');
    } catch {
      addToast(t('common.error'), 'error');
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, addToast, t]);

  const copyUrl = useCallback((path: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/wiki/uploads/${path}`);
    addToast(t('common.copied'), 'success');
  }, [addToast]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] bg-bg-primary border border-border-primary rounded-xl shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary shrink-0">
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5 text-accent" />
              <Dialog.Title className="font-display font-semibold text-text-primary text-lg">
                {t('media.title')}
              </Dialog.Title>
              <span className="text-sm text-text-muted">({attachments.length} file)</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? t('common.uploading') : t('common.upload')}
              </Button>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
              </Dialog.Close>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : attachments.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('media.noFiles')}</p>
                <p className="text-xs mt-1">{t('media.noFilesDesc')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <AnimatePresence>
                  {attachments.map((att) => (
                    <motion.div
                      key={att.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group relative rounded-lg border border-border-primary bg-bg-secondary overflow-hidden"
                    >
                      {isImage(att.mimeType) ? (
                        <div className="aspect-square bg-bg-tertiary flex items-center justify-center">
                          <img
                            src={`/wiki/uploads/${att.path}`}
                            alt={att.originalName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-square bg-bg-tertiary flex flex-col items-center justify-center gap-2">
                          {att.mimeType.includes('pdf') ? (
                            <FileText className="h-8 w-8 text-red-400" />
                          ) : (
                            <File className="h-8 w-8 text-text-muted" />
                          )}
                          <span className="text-xs text-text-muted px-2 text-center truncate w-full">
                            {att.originalName}
                          </span>
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="!text-white hover:!bg-white/20"
                          onClick={() => copyUrl(att.path)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="!text-white hover:!bg-red-500/40"
                          onClick={() => setDeleteTargetId(att.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* File info */}
                      <div className="px-2 py-1.5 border-t border-border-primary">
                        <p className="text-xs text-text-primary truncate">{att.originalName}</p>
                        <p className="text-xs text-text-muted">{formatSize(att.size)}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        title={t('media.deleteTitle')}
        description={t('media.deleteConfirm')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDeleteFile}
      />
    </Dialog.Root>
  );
}
