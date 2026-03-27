import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, RotateCcw, Diff, Columns2, AlignJustify } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { getPageVersions, getPageVersion, restorePageVersion } from '@/api/pages';
import { usePageStore } from '@/stores/pageStore';
import { useToastStore } from '@/stores/toastStore';
import { useT, formatRelativeTime } from '@/i18n';
import { cn } from '@/lib/utils';
import { diffBlocks, alignDiffForSplit } from '@/utils/diff';
import type { DiffBlock, DiffWord, SplitRow } from '@/utils/diff';
import type { PageVersion } from '@/types';

interface VersionHistoryProps {
  pageId: string;
  open: boolean;
  onClose: () => void;
  onRestore: () => void;
}

function DiffView({ diff }: { diff: DiffBlock[] }) {
  const t = useT();

  if (diff.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted text-sm">
        {t('version.noDifferences')}
      </div>
    );
  }

  return (
    <div className="space-y-0.5 text-sm leading-relaxed">
      {diff.map((block, i) => {
        if (block.type === 'unchanged') {
          return (
            <div key={i} className="px-4 py-2 text-text-muted font-mono">
              <span className="select-none opacity-40 mr-3 inline-block w-4 text-right">&nbsp;</span>
              {block.text}
            </div>
          );
        }
        if (block.type === 'added') {
          return (
            <div key={i} className="px-4 py-2 bg-emerald-500/10 border-l-3 border-emerald-500 text-emerald-300 font-mono">
              <span className="select-none opacity-60 mr-3 inline-block w-4 text-right font-bold">+</span>
              {block.text}
            </div>
          );
        }
        if (block.type === 'removed') {
          return (
            <div key={i} className="px-4 py-2 bg-red-500/10 border-l-3 border-red-500 text-red-400 font-mono line-through decoration-red-500/40">
              <span className="select-none opacity-60 mr-3 inline-block w-4 text-right font-bold">-</span>
              {block.text}
            </div>
          );
        }
        // modified — word-level diff
        return (
          <div key={i} className="border-l-3 border-amber-500">
            <div className="px-4 py-2 bg-red-500/8 font-mono">
              <span className="select-none opacity-60 mr-3 inline-block w-4 text-right font-bold text-red-400">-</span>
              {block.words?.map((w: DiffWord, j: number) => (
                <span
                  key={j}
                  className={cn(
                    w.type === 'removed' && 'bg-red-500/20 text-red-400 line-through decoration-red-500/50 rounded px-0.5',
                    w.type === 'unchanged' && 'text-text-muted',
                    w.type === 'added' && 'hidden',
                  )}
                >
                  {w.text}
                </span>
              ))}
            </div>
            <div className="px-4 py-2 bg-emerald-500/8 font-mono">
              <span className="select-none opacity-60 mr-3 inline-block w-4 text-right font-bold text-emerald-400">+</span>
              {block.words?.map((w: DiffWord, j: number) => (
                <span
                  key={j}
                  className={cn(
                    w.type === 'added' && 'bg-emerald-500/20 text-emerald-300 rounded px-0.5',
                    w.type === 'unchanged' && 'text-text-muted',
                    w.type === 'removed' && 'hidden',
                  )}
                >
                  {w.text}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SplitDiffView({ diff }: { diff: DiffBlock[] }) {
  const t = useT();
  const rows = useMemo(() => alignDiffForSplit(diff), [diff]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted text-sm">
        {t('version.noDifferences')}
      </div>
    );
  }

  return (
    <div className="text-sm leading-relaxed">
      {/* Column headers */}
      <div className="grid grid-cols-2 border-b border-border-primary bg-bg-secondary/50 sticky top-0 z-10">
        <div className="px-4 py-2 text-xs font-semibold text-text-muted border-r border-border-primary">
          {t('version.oldVersion')}
        </div>
        <div className="px-4 py-2 text-xs font-semibold text-text-muted">
          {t('version.currentVersion')}
        </div>
      </div>

      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-2">
          {/* Left side */}
          <div
            className={cn(
              'px-4 py-2 font-mono border-r border-border-primary min-h-[2rem]',
              row.type === 'removed' && 'bg-red-500/10 text-red-400',
              row.type === 'modified' && 'bg-amber-500/8',
              row.type === 'added' && 'bg-bg-primary/50',
              row.type === 'unchanged' && 'text-text-muted',
            )}
          >
            {row.type === 'modified' && row.leftWords
              ? row.leftWords.map((w, j) => (
                  <span
                    key={j}
                    className={cn(
                      w.type === 'removed' && 'bg-red-500/20 text-red-400 line-through decoration-red-500/50 rounded px-0.5',
                      w.type === 'unchanged' && 'text-text-muted',
                    )}
                  >
                    {w.text}
                  </span>
                ))
              : row.left}
          </div>

          {/* Right side */}
          <div
            className={cn(
              'px-4 py-2 font-mono min-h-[2rem]',
              row.type === 'added' && 'bg-emerald-500/10 text-emerald-300',
              row.type === 'modified' && 'bg-amber-500/8',
              row.type === 'removed' && 'bg-bg-primary/50',
              row.type === 'unchanged' && 'text-text-muted',
            )}
          >
            {row.type === 'modified' && row.rightWords
              ? row.rightWords.map((w, j) => (
                  <span
                    key={j}
                    className={cn(
                      w.type === 'added' && 'bg-emerald-500/20 text-emerald-300 rounded px-0.5',
                      w.type === 'unchanged' && 'text-text-muted',
                    )}
                  >
                    {w.text}
                  </span>
                ))
              : row.right}
          </div>
        </div>
      ))}
    </div>
  );
}

export function VersionHistory({ pageId, open, onClose, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<Record<string, unknown> | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [viewMode, setViewMode] = useState<'inline' | 'split'>('split');
  const { currentPage } = usePageStore();
  const { addToast } = useToastStore();
  const t = useT();

  useEffect(() => {
    if (open && pageId) {
      setLoading(true);
      setSelectedId(null);
      setPreviewContent(null);
      getPageVersions(pageId)
        .then(setVersions)
        .catch(() => addToast(t('version.loadError'), 'error'))
        .finally(() => setLoading(false));
    }
  }, [open, pageId, addToast]);

  const handleSelect = useCallback(async (versionId: string) => {
    setSelectedId(versionId);
    try {
      const version = await getPageVersion(pageId, versionId);
      setPreviewContent(version.content ?? null);
    } catch {
      addToast(t('version.loadOneError'), 'error');
    }
  }, [pageId, addToast]);

  const handleRestore = useCallback(async () => {
    if (!selectedId) return;
    setRestoring(true);
    try {
      await restorePageVersion(pageId, selectedId);
      addToast(t('version.restored'), 'success');
      onRestore();
      onClose();
    } catch {
      addToast(t('version.restoreError'), 'error');
    } finally {
      setRestoring(false);
    }
  }, [pageId, selectedId, addToast, onRestore, onClose]);

  const diff = useMemo(() => {
    if (!previewContent || !currentPage?.content) return null;
    return diffBlocks(previewContent, currentPage.content);
  }, [previewContent, currentPage?.content]);

  const selectedVersion = versions.find((v) => v.id === selectedId);

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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Full-screen panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed inset-4 md:inset-6 lg:inset-10 z-50 flex flex-col rounded-2xl border border-border-primary bg-bg-primary shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary bg-bg-secondary shrink-0">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-accent" />
                <h2 className="font-display font-semibold text-text-primary text-lg">{t('version.title')}</h2>
                {selectedVersion && (
                  <span className="px-2.5 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                    {formatRelativeTime(selectedVersion.createdAt)} · {selectedVersion.editedBy.name || selectedVersion.editedBy.email}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Body: split layout */}
            <div className="flex flex-1 min-h-0">
              {/* Left: version list */}
              <div className="w-72 shrink-0 border-r border-border-primary flex flex-col bg-bg-secondary/50">
                <div className="px-4 py-3 border-b border-border-primary">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    {t('version.versionList')}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {loading ? (
                    <div className="space-y-2 p-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : versions.length === 0 ? (
                    <div className="p-6 text-center text-text-muted text-sm">
                      <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>{t('version.noVersions')}</p>
                      <p className="text-xs mt-1">{t('version.autoCreated')}</p>
                    </div>
                  ) : (
                    versions.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleSelect(v.id)}
                        className={cn(
                          'w-full text-left px-3 py-3 rounded-lg transition-colors mb-1',
                          selectedId === v.id
                            ? 'bg-accent/10 border border-accent/30'
                            : 'hover:bg-bg-hover border border-transparent',
                        )}
                      >
                        <span className="font-medium text-sm text-text-primary truncate block">
                          {v.title}
                        </span>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                          <span>{formatRelativeTime(v.createdAt)}</span>
                          <span>·</span>
                          <span className="truncate">{v.editedBy.name || v.editedBy.email}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right: diff view */}
              <div className="flex-1 flex flex-col min-w-0">
                {!selectedId ? (
                  <div className="flex-1 flex items-center justify-center text-text-muted">
                    <div className="text-center">
                      <Diff className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p className="text-sm">{t('version.selectToCompare')}</p>
                    </div>
                  </div>
                ) : !previewContent ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <>
                    {/* Diff header */}
                    <div className="px-6 py-3 border-b border-border-primary bg-bg-secondary/50 shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-text-primary">
                            {t('version.diffTitle')}
                          </h3>
                          <p className="text-xs text-text-muted mt-0.5">
                            {t('version.diffDesc')}
                          </p>
                        </div>
                        {diff && (
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded bg-red-500/20 border border-red-500/40" />
                                <span className="text-text-muted">{t('version.removed')}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40" />
                                <span className="text-text-muted">{t('version.added')}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40" />
                                <span className="text-text-muted">{t('version.modified')}</span>
                              </span>
                            </div>
                            <div className="flex items-center rounded-lg border border-border-primary bg-bg-primary overflow-hidden">
                              <button
                                onClick={() => setViewMode('inline')}
                                className={cn(
                                  'flex items-center gap-1 px-2.5 py-1 text-xs transition-colors',
                                  viewMode === 'inline'
                                    ? 'bg-accent/15 text-accent font-medium'
                                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                                )}
                              >
                                <AlignJustify className="h-3 w-3" />
                                {t('version.viewInline')}
                              </button>
                              <button
                                onClick={() => setViewMode('split')}
                                className={cn(
                                  'flex items-center gap-1 px-2.5 py-1 text-xs transition-colors border-l border-border-primary',
                                  viewMode === 'split'
                                    ? 'bg-accent/15 text-accent font-medium'
                                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                                )}
                              >
                                <Columns2 className="h-3 w-3" />
                                {t('version.viewSplit')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Diff content */}
                    <div className="flex-1 overflow-y-auto">
                      {diff ? (
                        viewMode === 'inline'
                          ? <DiffView diff={diff} />
                          : <SplitDiffView diff={diff} />
                      ) : (
                        <div className="flex-1 flex items-center justify-center p-8 text-text-muted text-sm">
                          {t('version.noDifferences')}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            {selectedId && previewContent && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex items-center justify-between px-6 py-4 border-t border-border-primary bg-bg-secondary shrink-0"
              >
                <p className="text-xs text-text-muted">
                  {t('version.restoreNote')}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    {t('common.close')}
                  </Button>
                  <Button
                    onClick={handleRestore}
                    disabled={restoring}
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {restoring ? t('version.restoring') : t('version.restoreBtn')}
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
