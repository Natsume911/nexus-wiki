import { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
  DragOverlay, MeasuringStrategy,
} from '@dnd-kit/core';
import { Plus, Upload, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { PageTreeItem } from './PageTreeItem';
import { CreatePageModal } from './CreatePageModal';
import { MovePageModal } from './MovePageModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usePageStore } from '@/stores/pageStore';
import { useSpaceStore } from '@/stores/spaceStore';
import { useToastStore } from '@/stores/toastStore';
import { reorderPages } from '@/api/pages';
import { movePage as movePageApi, duplicatePage as duplicatePageApi } from '@/api/pageOperations';
import { archivePage as archivePageApi } from '@/api/archive';
import { importMarkdownFile } from '@/api/import';
import { useT } from '@/i18n';
import type { PageTreeNode } from '@/types';

// ── Drop position types ─────────────────────────────────────────────
export type DropPosition = 'before' | 'after' | 'inside' | null;
export interface DropTarget {
  nodeId: string;
  position: DropPosition;
}

// ── Helpers to flatten and navigate the tree ────────────────────────
function flattenTree(nodes: PageTreeNode[]): { node: PageTreeNode; parentId: string | null; depth: number }[] {
  const flat: { node: PageTreeNode; parentId: string | null; depth: number }[] = [];
  function walk(items: PageTreeNode[], parentId: string | null, depth: number) {
    for (const item of items) {
      flat.push({ node: item, parentId, depth });
      if (item.children?.length) walk(item.children, item.id, depth + 1);
    }
  }
  walk(nodes, null, 0);
  return flat;
}

function findNodeById(nodes: PageTreeNode[], id: string): PageTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function getDescendantIds(node: PageTreeNode): Set<string> {
  const ids = new Set<string>();
  function walk(n: PageTreeNode) {
    ids.add(n.id);
    n.children?.forEach(walk);
  }
  walk(node);
  return ids;
}

function getSiblings(tree: PageTreeNode[], nodeId: string): { siblings: PageTreeNode[]; parentId: string | null } | null {
  // Check root level
  if (tree.some((n) => n.id === nodeId)) return { siblings: tree, parentId: null };
  // Check children recursively
  for (const node of tree) {
    if (node.children?.some((c) => c.id === nodeId)) {
      return { siblings: node.children, parentId: node.id };
    }
    if (node.children?.length) {
      const found = getSiblings(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────

export function PageTree() {
  const { spaceSlug } = useParams<{ spaceSlug: string }>();
  const navigate = useNavigate();
  const { pageTree, treeLoading, deletePage, fetchPageTree } = usePageStore();
  const { currentSpace } = useSpaceStore();
  const { addToast } = useToastStore();
  const t = useT();
  const [expandSignal, setExpandSignal] = useState(0);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | undefined>();
  const [moveModal, setMoveModal] = useState<{
    open: boolean;
    pageId: string;
    pageTitle: string;
    currentParentId: string | null;
  }>({ open: false, pageId: '', pageTitle: '', currentParentId: null });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>({ nodeId: '', position: null });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !spaceSlug) return;
    try {
      const page = await importMarkdownFile(spaceSlug, file);
      addToast(t('sidebar.imported', { title: page.title }), 'success');
      fetchPageTree(spaceSlug);
      navigate(`/${spaceSlug}/${page.slug}`);
    } catch {
      addToast(t('sidebar.importError'), 'error');
    }
    if (importRef.current) importRef.current.value = '';
  }, [spaceSlug, addToast, fetchPageTree, navigate]);

  const handleCreateChild = (parentId: string) => {
    setCreateParentId(parentId);
    setCreateModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!spaceSlug) return;
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!spaceSlug || !deleteTarget) return;
    try {
      await deletePage(deleteTarget, spaceSlug);
      addToast(t('sidebar.pageDeleted'), 'success');
    } catch {
      addToast(t('sidebar.pageDeleteError'), 'error');
    }
    setDeleteTarget(null);
  };

  const handleArchive = (id: string) => {
    setArchiveTarget(id);
  };

  const confirmArchive = async () => {
    if (!spaceSlug || !archiveTarget) return;
    try {
      await archivePageApi(archiveTarget);
      fetchPageTree(spaceSlug);
      addToast(t('archive.pageArchived'), 'success');
    } catch {
      addToast(t('archive.archiveError'), 'error');
    }
    setArchiveTarget(null);
  };

  const handleMove = (pageId: string, pageTitle: string, currentParentId: string | null) => {
    setMoveModal({ open: true, pageId, pageTitle, currentParentId });
  };

  const handleMoveConfirm = async (targetParentId: string | null) => {
    if (!spaceSlug || !currentSpace) return;
    try {
      await movePageApi(moveModal.pageId, currentSpace.id, targetParentId ?? undefined);
      addToast(t('sidebar.pageMoved'), 'success');
      fetchPageTree(spaceSlug);
    } catch {
      addToast(t('sidebar.pageMoveError'), 'error');
    }
  };

  const handleDuplicate = async (pageId: string) => {
    if (!spaceSlug) return;
    try {
      const page = await duplicatePageApi(pageId);
      addToast(t('sidebar.pageDuplicated'), 'success');
      fetchPageTree(spaceSlug);
      if (page && typeof page === 'object' && 'slug' in page) {
        navigate(`/${spaceSlug}/${(page as { slug: string }).slug}`);
      }
    } catch {
      addToast(t('sidebar.pageDuplicateError'), 'error');
    }
  };

  const handlePageCreated = (slug: string) => {
    if (spaceSlug) navigate(`/${spaceSlug}/${slug}`);
  };

  // ── Drag handlers ────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setDropTarget({ nodeId: '', position: null });
      return;
    }

    const overId = over.id as string;
    const activeId = active.id as string;

    // Don't allow dropping onto self or descendants
    const activeNode = findNodeById(pageTree, activeId);
    if (activeNode) {
      const descendants = getDescendantIds(activeNode);
      if (descendants.has(overId)) {
        setDropTarget({ nodeId: '', position: null });
        return;
      }
    }

    // Determine position based on cursor position relative to element
    const overRect = over.rect;
    const cursorY = (event.activatorEvent as MouseEvent).clientY + (event.delta?.y ?? 0);
    const relativeY = cursorY - overRect.top;
    const height = overRect.height;

    let position: DropPosition;
    if (relativeY < height * 0.25) {
      position = 'before';
    } else if (relativeY > height * 0.75) {
      position = 'after';
    } else {
      position = 'inside'; // Drop as child
    }

    setDropTarget({ nodeId: overId, position });
  }, [pageTree]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active } = event;
    const activeId = active.id as string;

    setDragId(null);

    if (!dropTarget.position || !dropTarget.nodeId || !spaceSlug) {
      setDropTarget({ nodeId: '', position: null });
      return;
    }

    const targetId = dropTarget.nodeId;
    const position = dropTarget.position;
    setDropTarget({ nodeId: '', position: null });

    // Don't drop on self
    if (activeId === targetId) return;

    // Prevent circular
    const activeNode = findNodeById(pageTree, activeId);
    if (activeNode && getDescendantIds(activeNode).has(targetId)) return;

    try {
      if (position === 'inside') {
        // Reparent: make active a child of target
        const targetNode = findNodeById(pageTree, targetId);
        const newOrder = (targetNode?.children?.length ?? 0);

        await reorderPages([{ id: activeId, parentId: targetId, order: newOrder }]);
        addToast(t('sidebar.pageMoved'), 'success');
      } else {
        // Reorder: place before/after target
        const targetInfo = getSiblings(pageTree, targetId);
        if (!targetInfo) return;

        const { siblings, parentId } = targetInfo;

        // Remove active from its current position if it's in this siblings list
        const filteredSiblings = siblings.filter((s) => s.id !== activeId);
        const targetIndex = filteredSiblings.findIndex((s) => s.id === targetId);
        if (targetIndex === -1) {
          // Active is coming from a different parent — insert it
          const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
          // Just use reorderPages with the new parentId + order
          const payload: { id: string; parentId: string | null; order: number }[] = [];

          // Build new order for all siblings + the moved item
          const newList = [...filteredSiblings];
          const actualInsert = position === 'before'
            ? filteredSiblings.findIndex((s) => s.id === targetId)
            : filteredSiblings.findIndex((s) => s.id === targetId) + 1;
          newList.splice(actualInsert, 0, { id: activeId } as PageTreeNode);

          for (let i = 0; i < newList.length; i++) {
            payload.push({ id: newList[i].id, parentId, order: i });
          }
          await reorderPages(payload);
          addToast(t('sidebar.pageMoved'), 'success');
        } else {
          // Same parent — simple reorder
          const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
          filteredSiblings.splice(insertIndex, 0, { id: activeId } as PageTreeNode);

          const payload = filteredSiblings.map((s, i) => ({
            id: s.id,
            parentId,
            order: i,
          }));
          await reorderPages(payload);
        }
      }

      fetchPageTree(spaceSlug);
    } catch {
      addToast(t('sidebar.moveError'), 'error');
    }
  }, [dropTarget, pageTree, spaceSlug, fetchPageTree, addToast, t]);

  const handleDragCancel = useCallback(() => {
    setDragId(null);
    setDropTarget({ nodeId: '', position: null });
  }, []);

  if (treeLoading) {
    return (
      <div className="space-y-1 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 mx-2" />
        ))}
      </div>
    );
  }

  const dragNode = dragId ? findNodeById(pageTree, dragId) : null;

  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-3 py-1.5 mb-1 sticky top-0 z-10 bg-bg-primary">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('sidebar.pages')}</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setExpandSignal(s => s + 1)}
            className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title={expandSignal % 2 === 0 ? t('sidebar.expandAll') : t('sidebar.collapseAll')}
          >
            {expandSignal % 2 === 0
              ? <ChevronsUpDown className="h-3.5 w-3.5" />
              : <ChevronsDownUp className="h-3.5 w-3.5" />}
          </button>
          <input ref={importRef} type="file" accept=".md,.markdown" className="hidden" onChange={handleImport} />
          <button
            onClick={() => importRef.current?.click()}
            className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title={t('sidebar.importMarkdown')}
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setCreateParentId(undefined); setCreateModalOpen(true); }}
            className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title={t('sidebar.newPage')}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {pageTree.length === 0 ? (
        <div className="px-3 py-4 text-center text-sm text-text-muted">
          {t('sidebar.noPages')}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
          {pageTree.map((node) => (
            <PageTreeItem
              key={node.id}
              node={node}
              spaceSlug={spaceSlug || ''}
              depth={0}
              expandSignal={expandSignal}
              dragId={dragId}
              dropTarget={dropTarget}
              onCreateChild={handleCreateChild}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onMove={handleMove}
              onDuplicate={handleDuplicate}
            />
          ))}

          <DragOverlay dropAnimation={null}>
            {dragNode && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-secondary border border-accent/40 shadow-lg text-sm text-text-primary opacity-90">
                <span className="truncate max-w-[180px]">{dragNode.title}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {currentSpace && spaceSlug && (
        <CreatePageModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          spaceSlug={spaceSlug}
          parentId={createParentId}
          onCreated={handlePageCreated}
        />
      )}

      <MovePageModal
        open={moveModal.open}
        onOpenChange={(open) => setMoveModal((prev) => ({ ...prev, open }))}
        pageId={moveModal.pageId}
        pageTitle={moveModal.pageTitle}
        currentParentId={moveModal.currentParentId}
        pageTree={pageTree}
        onMove={handleMoveConfirm}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t('sidebar.deleteTitle')}
        description={t('sidebar.deleteConfirm')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}
        title={t('archive.confirmTitle')}
        description={t('archive.confirmArchive')}
        confirmLabel={t('archive.archivePage')}
        onConfirm={confirmArchive}
      />
    </div>
  );
}
