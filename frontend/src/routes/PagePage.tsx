import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Download, FileText, FileCode, Printer, Star, Eye, EyeOff, Bell, BellOff, Pencil, Lock, Mail, Archive, AlertTriangle } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { NexusEditor } from '@/components/editor/NexusEditor';
import { EditorErrorBoundary } from '@/components/editor/EditorErrorBoundary';
import { VersionHistory } from '@/components/editor/VersionHistory';
import { CommentsSection } from '@/components/editor/CommentsSection';
import { TagsBar } from '@/components/editor/TagsBar';
import { BacklinksPanel } from '@/components/editor/BacklinksPanel';
import { LocalGraph } from '@/components/graph/LocalGraph';
import { AttachmentsPanel } from '@/components/editor/AttachmentsPanel';
import { TranslateMenu } from '@/components/editor/TranslateMenu';
// TOC sidebar removed — inline TableOfContents extension in page content is sufficient
import { PageViewers } from '@/components/editor/PageViewers';
import { SaveIndicator } from '@/components/ui/SaveIndicator';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePageStore } from '@/stores/pageStore';
import { useSpaceStore } from '@/stores/spaceStore';
import { getSpace } from '@/api/spaces';
import { updatePage } from '@/api/pages';
import { useToastStore } from '@/stores/toastStore';
import { toggleFavorite } from '@/api/favorites';
import { toggleWatch as toggleWatchApi } from '@/api/watch';
import { useReadingMode } from '@/components/ui/ReadingMode';
import { Input } from '@/components/ui/Input';
import { useT, formatDate } from '@/i18n';
import { sendPageAsEmail } from '@/utils/emailExport';
import { restoreFromArchive } from '@/api/archive';
import { ReactionsBar } from '@/components/editor/ReactionsBar';
import type { Collaborator } from '@/hooks/useCollaboration';
// import { recordPageView, getPageViews } from '@/api/analytics';

export function PagePage() {
  const { spaceSlug, pageSlug } = useParams<{ spaceSlug: string; pageSlug: string }>();
  const { currentPage, pageLoading, fetchPage, fetchPageTree, favorited: storeFavorited, watching: storeWatching, setFavorited: setStoreFavorited, setWatching: setStoreWatching } = usePageStore();
  const { currentSpace, setCurrentSpace } = useSpaceStore();
  const { addToast } = useToastStore();
  const [title, setTitle] = useState('');
  const [titleTimeout, setTitleTimeout] = useState<ReturnType<typeof setTimeout>>();
  const [versionOpen, setVersionOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [collabUsers, setCollabUsers] = useState<Collaborator[]>([]);
  const { isReadingMode, toggleReadingMode } = useReadingMode();
  const t = useT();

  const handleCollaboratorsChange = useCallback((collaborators: Collaborator[]) => {
    setCollabUsers(collaborators);
  }, []);

  // ── Page lock state ──
  const [lockedBy, setLockedBy] = useState<{ userName: string; isMe: boolean } | null>(null);
  const lockRenewRef = useRef<ReturnType<typeof setInterval>>();

  // Check lock status when page loads
  useEffect(() => {
    if (!currentPage) return;
    fetch(`/wiki/api/pages/${currentPage.id}/lock`).then(r => r.json()).then(d => {
      const lock = d.data;
      if (lock.locked && !lock.isMe) {
        setLockedBy({ userName: lock.userName, isMe: false });
      } else {
        setLockedBy(null);
      }
    }).catch(() => {});
  }, [currentPage?.id]);

  // Release lock on unmount
  useEffect(() => {
    return () => {
      if (editing && currentPage) {
        fetch(`/wiki/api/pages/${currentPage.id}/lock`, { method: 'DELETE', keepalive: true }).catch(() => {});
      }
      if (lockRenewRef.current) clearInterval(lockRenewRef.current);
    };
  }, [editing, currentPage?.id]);

  const handleToggleEdit = useCallback(async () => {
    if (isReadingMode) return;
    if (editing) {
      // Save first, then release lock
      const saved = new Promise<void>((resolve) => {
        const done = () => resolve();
        window.addEventListener('nexus:save-done', done, { once: true });
        window.dispatchEvent(new Event('nexus:save-now'));
        setTimeout(done, 3000);
      });
      await saved;
      // Release lock
      if (currentPage) {
        fetch(`/wiki/api/pages/${currentPage.id}/lock`, { method: 'DELETE' }).catch(() => {});
      }
      if (lockRenewRef.current) clearInterval(lockRenewRef.current);
      setEditing(false);
      setLockedBy(null);
      if (spaceSlug && pageSlug) {
        setTimeout(() => fetchPage(spaceSlug, pageSlug), 200);
      }
    } else {
      // Try to acquire lock
      if (!currentPage) return;
      const res = await fetch(`/wiki/api/pages/${currentPage.id}/lock`, { method: 'POST' });
      if (res.status === 409) {
        const body = await res.json();
        addToast(body.error || 'Pagina in modifica da un altro utente', 'warning');
        return;
      }
      setEditing(true);
      // Renew lock every 3 minutes
      lockRenewRef.current = setInterval(() => {
        fetch(`/wiki/api/pages/${currentPage.id}/lock`, { method: 'POST' }).catch(() => {});
      }, 3 * 60 * 1000);
    }
  }, [editing, isReadingMode, spaceSlug, pageSlug, fetchPage, currentPage, addToast]);

  const handleToggleFavorite = useCallback(async () => {
    if (!currentPage) return;
    try {
      const r = await toggleFavorite(currentPage.id);
      setStoreFavorited(r.favorited);
      addToast(r.favorited ? t('page.addedToFavorites') : t('page.removedFromFavorites'), 'success');
    } catch { addToast(t('common.error'), 'error'); }
  }, [currentPage, setStoreFavorited, addToast, t]);

  const handleToggleWatch = useCallback(async () => {
    if (!currentPage) return;
    try {
      const r = await toggleWatchApi(currentPage.id);
      setStoreWatching(r.watching);
      addToast(r.watching ? t('page.watchingPage') : t('page.unwatchedPage'), 'success');
    } catch { addToast(t('common.error'), 'error'); }
  }, [currentPage, setStoreWatching, addToast, t]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if inside input, textarea, or contenteditable
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return; // All page shortcuts require Ctrl/Cmd

      const key = e.key.toLowerCase();

      if (!e.shiftKey && key === 'e') {
        // Ctrl+E — toggle edit (safe: not a standard browser shortcut)
        e.preventDefault();
        handleToggleEdit();
      } else if (e.shiftKey) {
        // Ctrl+Shift combos — avoid clashing with browser Ctrl+H/W/F/R
        switch (key) {
          case 'f':
            e.preventDefault();
            handleToggleFavorite();
            break;
          case 'w':
            e.preventDefault();
            handleToggleWatch();
            break;
          case 'h':
            e.preventDefault();
            setVersionOpen(true);
            break;
          case 'l':
            e.preventDefault();
            toggleReadingMode();
            break;
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleToggleEdit, handleToggleFavorite, handleToggleWatch, toggleReadingMode]);

  useEffect(() => {
    if (!spaceSlug) return;
    if (!currentSpace || currentSpace.slug !== spaceSlug) {
      getSpace(spaceSlug).then(setCurrentSpace).catch(() => {});
    }
  }, [spaceSlug, currentSpace, setCurrentSpace]);

  useEffect(() => {
    if (spaceSlug && pageSlug) {
      fetchPage(spaceSlug, pageSlug);
    }
  }, [spaceSlug, pageSlug, fetchPage]);

  // Reset edit mode when navigating to another page
  useEffect(() => {
    setEditing(false);
  }, [spaceSlug, pageSlug]);

  useEffect(() => {
    if (currentPage) {
      setTitle(currentPage.title);
    }
  }, [currentPage]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    clearTimeout(titleTimeout);
    if (currentPage && newTitle.trim()) {
      const timeout = setTimeout(async () => {
        try {
          await updatePage(currentPage.id, { title: newTitle });
          if (spaceSlug) fetchPageTree(spaceSlug);
        } catch {
          addToast(t('page.titleUpdateError'), 'error');
        }
      }, 1500);
      setTitleTimeout(timeout);
    }
  }, [currentPage, spaceSlug, titleTimeout, fetchPageTree, addToast]);

  // Sticky bar — show border when scrolled past its natural position
  const stickyBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stickyBarRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        // When the bar is stuck (not fully intersecting), show border
        el.style.borderBottomColor = entry.intersectionRatio < 1
          ? 'var(--color-border-primary)'
          : 'transparent';
      },
      { threshold: [1], rootMargin: '-1px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentPage?.id]);

  if (pageLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!currentPage) {
    return (
      <div className="text-center py-16">
        <p className="text-text-muted">{t('page.notFound')}</p>
      </div>
    );
  }

  return (
    <motion.div
      key={currentPage.id}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Archived banner */}
      {currentPage.archivedAt && (
        <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
          <Archive className="h-5 w-5 shrink-0" />
          <span className="text-sm flex-1">{t('archive.archivedBanner')}</span>
          <Button
            variant="secondary"
            size="sm"
            className="!h-7 !px-3 !text-xs"
            onClick={async () => {
              try {
                await restoreFromArchive(currentPage.id);
                if (spaceSlug && pageSlug) fetchPage(spaceSlug, pageSlug);
                if (spaceSlug) fetchPageTree(spaceSlug);
                addToast(t('archive.pageRestored'), 'success');
              } catch { addToast(t('archive.restoreError'), 'error'); }
            }}
          >
            {t('archive.restoreFromBanner')}
          </Button>
        </div>
      )}

      {/* Stale content banner */}
      {!currentPage.archivedAt && (() => {
        const daysSinceUpdate = Math.floor((Date.now() - new Date(currentPage.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceUpdate > 90 ? (
          <div className="flex items-center gap-3 px-4 py-2.5 mb-4 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-xs">{t('stale.message', { days: String(daysSinceUpdate) })}</span>
          </div>
        ) : null;
      })()}

      {/* Title */}
      <div className="mb-2">
        {editing && !isReadingMode ? (
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="!text-3xl !font-display !font-bold !bg-transparent !border-0 !px-0 !h-auto !ring-0 focus:!ring-0 text-text-primary"
            placeholder={t('page.titlePlaceholder')}
          />
        ) : (
          <h1 className="text-3xl font-display font-bold text-text-primary break-words">{title}</h1>
        )}
        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
          <span>{t('page.by', { author: currentPage.author.name || currentPage.author.email })}</span>
          <span>·</span>
          <span>
            {formatDate(currentPage.updatedAt, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {editing && (
            <>
              <span>·</span>
              <SaveIndicator />
            </>
          )}
        </div>
        {/* Presence bar — collaborators editing this page */}
        {editing && collabUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 mt-2"
          >
            <div className="flex -space-x-2">
              {collabUsers.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  title={c.name || c.email}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white ring-2 ring-bg-primary transition-transform hover:scale-110 hover:z-10"
                  style={{ backgroundColor: c.color }}
                >
                  {(c.name || c.email || '?').charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            {collabUsers.length > 6 && (
              <span className="text-xs text-text-muted">+{collabUsers.length - 6}</span>
            )}
            <span className="text-xs text-text-muted">
              {collabUsers.length === 1
                ? t('collab.oneEditing', { name: collabUsers[0]?.name || collabUsers[0]?.email || '' })
                : t('collab.manyEditing', { count: collabUsers.length })}
            </span>
            {collabUsers.some(c => c.typing) && (
              <span className="text-xs text-text-muted italic animate-pulse">
                {t('collab.someoneTyping')}
              </span>
            )}
          </motion.div>
        )}

        {/* Reactions */}
        <ReactionsBar pageId={currentPage.id} />
      </div>

      {/* Sticky action bar — stays on top when scrolling */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-2 mb-4 bg-bg-primary/80 backdrop-blur-md border-b border-border-primary/0 transition-[border-color] duration-200"
        ref={stickyBarRef}
      >
        <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
          {/* Edit / View toggle — primary action */}
          {!isReadingMode && !currentPage.archivedAt && (
            <Button
              variant={editing ? 'default' : 'ghost'}
              size="sm"
              onClick={handleToggleEdit}
              disabled={!editing && lockedBy !== null && !lockedBy.isMe}
              className={editing
                ? '!text-xs !h-auto !px-2.5 !py-1 !bg-accent !text-white hover:!bg-accent-hover'
                : lockedBy && !lockedBy.isMe
                  ? '!text-xs !h-auto !px-2.5 !py-1 text-amber-400 cursor-not-allowed'
                  : '!text-xs !h-auto !px-2.5 !py-1 text-text-muted hover:text-text-primary'}
              title={lockedBy && !lockedBy.isMe ? `In modifica da ${lockedBy.userName}` : `${editing ? t('page.closeEdit') : t('page.edit')} (Ctrl+E)`}
            >
              {lockedBy && !lockedBy.isMe ? (
                <><Lock className="h-3 w-3 mr-1" /> {lockedBy.userName}</>
              ) : editing ? (
                <><Pencil className="h-3 w-3 mr-1" /> {t('page.closeEdit')}</>
              ) : (
                <><Pencil className="h-3 w-3 mr-1" /> {t('page.edit')}</>
              )}
            </Button>
          )}
          <span>·</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleFavorite}
            className="!text-xs !h-auto !px-1.5 !py-0.5 text-text-muted hover:text-text-primary"
            title={`${storeFavorited ? t('page.favorited') : t('page.favorite')} (Ctrl+Shift+F)`}
          >
            <Star className={`h-3 w-3 mr-1 ${storeFavorited ? 'fill-amber-400 text-amber-400' : ''}`} />
            {storeFavorited ? t('page.favorited') : t('page.favorite')}
          </Button>
          <span>·</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleWatch}
            className="!text-xs !h-auto !px-1.5 !py-0.5 text-text-muted hover:text-text-primary"
            title={`${storeWatching ? t('page.watching') : t('page.watch')} (Ctrl+Shift+W)`}
          >
            {storeWatching
              ? <BellOff className="h-3 w-3 mr-1 text-indigo-400" />
              : <Bell className="h-3 w-3 mr-1" />
            }
            {storeWatching ? t('page.watching') : t('page.watch')}
          </Button>
          <span>·</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleReadingMode}
            className="!text-xs !h-auto !px-1.5 !py-0.5 text-text-muted hover:text-text-primary"
            title={`${isReadingMode ? t('page.exitReading') : t('page.reading')} (Ctrl+Shift+L)`}
          >
            {isReadingMode
              ? <EyeOff className="h-3 w-3 mr-1 text-indigo-400" />
              : <Eye className="h-3 w-3 mr-1" />
            }
            {isReadingMode ? t('page.exitReading') : t('page.reading')}
          </Button>
          <span>·</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVersionOpen(true)}
            className="!text-xs !h-auto !px-1.5 !py-0.5 text-text-muted hover:text-text-primary"
            title={`${t('page.history')} (Ctrl+Shift+H)`}
          >
            <Clock className="h-3 w-3 mr-1" />
            {t('page.history')}
          </Button>
          <span>·</span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="!text-xs !h-auto !px-1.5 !py-0.5 text-text-muted hover:text-text-primary"
              >
                <Download className="h-3 w-3 mr-1" />
                {t('page.export')}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[160px] rounded-lg border border-border-primary bg-bg-secondary shadow-xl p-1 z-50"
                sideOffset={4}
              >
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary rounded-md cursor-pointer hover:bg-bg-hover hover:text-text-primary outline-none"
                  onSelect={() => {
                    window.open(`/wiki/api/pages/${currentPage.id}/export/docx`, '_blank');
                  }}
                >
                  <FileText className="h-4 w-4" /> DOCX
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary rounded-md cursor-pointer hover:bg-bg-hover hover:text-text-primary outline-none"
                  onSelect={() => {
                    window.open(`/wiki/api/pages/${currentPage.id}/export/markdown`, '_blank');
                  }}
                >
                  <FileCode className="h-4 w-4" /> Markdown
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary rounded-md cursor-pointer hover:bg-bg-hover hover:text-text-primary outline-none"
                  onSelect={() => {
                    const w = window.open(`/wiki/api/pages/${currentPage.id}/export/html`, '_blank');
                    if (w) {
                      w.onload = () => { w.print(); };
                    }
                  }}
                >
                  <Printer className="h-4 w-4" /> {t('page.pdfPrint')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary rounded-md cursor-pointer hover:bg-bg-hover hover:text-text-primary outline-none"
                  onSelect={() => {
                    window.open(`/wiki/api/pages/${currentPage.id}/export/pdf`, '_blank');
                  }}
                >
                  <FileText className="h-4 w-4" /> PDF
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <span>·</span>
          <Button
            variant="ghost"
            size="sm"
            isLoading={sendingEmail}
            onClick={async () => {
              setSendingEmail(true);
              try {
                await sendPageAsEmail(currentPage.id, title);
                addToast(t('page.emailCopied'), 'success');
              } catch (err: any) {
                addToast(t('page.emailError'), 'error');
              } finally {
                setSendingEmail(false);
              }
            }}
            className="!text-xs !h-auto !px-1.5 !py-0.5 text-text-muted hover:text-text-primary"
          >
            <Mail className="h-3 w-3 mr-1" />
            Email
          </Button>
          {!isReadingMode && (
            <>
              <span>·</span>
              <TranslateMenu
                pageId={currentPage.id}
                onTranslated={() => {}}
              />
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <EditorErrorBoundary>
        <NexusEditor
          pageId={currentPage.id}
          initialContent={currentPage.content as Record<string, unknown>}
          readingMode={isReadingMode || !editing || !!currentPage.archivedAt}
          onCollaboratorsChange={handleCollaboratorsChange}
        />
      </EditorErrorBoundary>

      {/* Tags */}
      <TagsBar pageId={currentPage.id} />

      {/* Page viewers (chi ha letto) */}
      <PageViewers pageId={currentPage.id} />

      {/* Comments (hidden in immersive reading mode) */}
      {!isReadingMode && <CommentsSection pageId={currentPage.id} />}

      {/* Attachments */}
      <AttachmentsPanel pageId={currentPage.id} />

      {/* Backlinks */}
      <BacklinksPanel pageId={currentPage.id} />

      {/* Local Graph — pages connected to this one */}
      <LocalGraph pageId={currentPage.id} />

      {/* Version History Panel */}
      <VersionHistory
        pageId={currentPage.id}
        open={versionOpen}
        onClose={() => setVersionOpen(false)}
        onRestore={() => {
          if (spaceSlug && pageSlug) fetchPage(spaceSlug, pageSlug);
        }}
      />
    </motion.div>
  );
}
