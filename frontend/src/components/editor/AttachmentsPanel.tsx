import { useState, useEffect, useCallback } from 'react';
import { Paperclip, Download, X, FileText, FileImage, FileCode, File } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getPageAttachments, deleteAttachment } from '@/api/attachments';
import { useSpaceStore } from '@/stores/spaceStore';
import { useT } from '@/i18n';
import type { Attachment } from '@/types';

interface Props {
  pageId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const cls = 'h-4 w-4 shrink-0';
  if (mimeType.startsWith('image/')) return <FileImage className={`${cls} text-emerald-400`} />;
  if (mimeType.includes('pdf')) return <FileText className={`${cls} text-red-400`} />;
  if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('javascript') || mimeType.includes('typescript'))
    return <FileCode className={`${cls} text-blue-400`} />;
  if (mimeType.includes('word') || mimeType.includes('document'))
    return <FileText className={`${cls} text-blue-400`} />;
  return <File className={`${cls} text-text-muted`} />;
}

export function AttachmentsPanel({ pageId }: Props) {
  const { currentSpace } = useSpaceStore();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const t = useT();

  const fetchAttachments = useCallback(() => {
    if (!currentSpace) return;
    setLoading(true);
    getPageAttachments(currentSpace.slug, pageId)
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setLoading(false));
  }, [currentSpace, pageId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Refresh when new attachments are uploaded
  useEffect(() => {
    const handler = () => fetchAttachments();
    window.addEventListener('nexus:attachments-changed', handler);
    return () => window.removeEventListener('nexus:attachments-changed', handler);
  }, [fetchAttachments]);

  if (loading) return null;
  if (attachments.length === 0) return null;

  const confirmDeleteAttachment = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAttachment(deleteTarget.id);
      setAttachments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    } catch {
      // silent
    }
    setDeleteTarget(null);
  };

  return (
    <div className="mt-8 pt-6 border-t border-border-primary">
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="h-4 w-4 text-text-muted" />
        <h3 className="text-sm font-medium text-text-secondary">
          {t('attachment.title', { count: attachments.length })}
        </h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => (
          <div
            key={att.id}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-tertiary text-sm text-text-secondary group"
          >
            <FileIcon mimeType={att.mimeType} />
            <span className="truncate max-w-[180px]" title={att.originalName}>
              {att.originalName}
            </span>
            <span className="text-xs text-text-muted">{formatSize(att.size)}</span>
            <a
              href={`/wiki/uploads/${att.path}`}
              download={att.originalName}
              className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent transition-colors"
              title={t('attachment.download')}
            >
              <Download className="h-3 w-3" />
            </a>
            <button
              onClick={() => setDeleteTarget({ id: att.id, name: att.originalName })}
              className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              title={t('attachment.delete')}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t('attachment.deleteTitle')}
        description={deleteTarget ? t('attachment.deleteConfirm', { name: deleteTarget.name }) : ''}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDeleteAttachment}
      />
    </div>
  );
}
