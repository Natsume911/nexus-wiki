import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  ChevronRight, FileText, Plus, GripVertical,
  MoreHorizontal, ArrowUpDown, Copy, Archive, Trash2,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';
import type { PageTreeNode } from '@/types';
import type { DropTarget } from './PageTree';
import { useT } from '@/i18n';
import { usePageStore } from '@/stores/pageStore';

interface PageTreeItemProps {
  node: PageTreeNode;
  spaceSlug: string;
  depth: number;
  expandSignal: number;
  dragId: string | null;
  dropTarget: DropTarget;
  onCreateChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onMove: (pageId: string, pageTitle: string, currentParentId: string | null) => void;
  onDuplicate: (pageId: string) => void;
}

export function PageTreeItem({
  node, spaceSlug, depth, expandSignal, dragId, dropTarget,
  onCreateChild, onDelete, onArchive, onMove, onDuplicate,
}: PageTreeItemProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('nexus:tree-expanded') || '[]') as string[];
      return saved.includes(node.id);
    } catch { return depth < 1; }
  });

  // Persist expansion state
  useEffect(() => {
    try {
      const saved = new Set(JSON.parse(sessionStorage.getItem('nexus:tree-expanded') || '[]') as string[]);
      if (expanded) saved.add(node.id); else saved.delete(node.id);
      sessionStorage.setItem('nexus:tree-expanded', JSON.stringify([...saved]));
    } catch {}
  }, [expanded, node.id]);

  // React to expand/collapse all signal
  useEffect(() => {
    if (expandSignal === 0) return;
    setExpanded(expandSignal % 2 !== 0);
  }, [expandSignal]);

  // Auto-expand when something is being dragged inside this node
  useEffect(() => {
    if (dropTarget.nodeId === node.id && dropTarget.position === 'inside' && !expanded) {
      const timer = setTimeout(() => setExpanded(true), 600);
      return () => clearTimeout(timer);
    }
  }, [dropTarget, node.id, expanded]);

  const [showActions, setShowActions] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { prefetchPage } = usePageStore();
  const { pageSlug } = useParams<{ pageSlug: string }>();
  const isActive = pageSlug === node.slug;
  const hasChildren = node.children && node.children.length > 0;
  const isDragged = dragId === node.id;

  // Draggable
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
  } = useDraggable({ id: node.id });

  // Droppable
  const { setNodeRef: setDropRef } = useDroppable({ id: node.id });

  // Determine drop indicator state for this node
  const isDropTarget = dropTarget.nodeId === node.id && dropTarget.position !== null;
  const dropPosition = isDropTarget ? dropTarget.position : null;

  return (
    <div
      ref={setDropRef}
      className="relative"
      style={{ opacity: isDragged ? 0.35 : 1 }}
    >
      {/* Drop indicator: line BEFORE */}
      {dropPosition === 'before' && (
        <div
          className="absolute left-0 right-0 top-0 z-10 h-0.5 bg-accent rounded-full"
          style={{ marginLeft: `${depth * 16 + 8}px` }}
        />
      )}

      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors text-sm',
          isActive
            ? 'bg-accent/15 text-accent'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
          // Highlight when drop target is "inside" (reparent)
          dropPosition === 'inside' && 'ring-1 ring-accent/60 bg-accent/10',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onMouseEnter={() => { setShowActions(true); prefetchPage(spaceSlug, node.slug); }}
        onMouseLeave={() => { if (!menuOpen) setShowActions(false); }}
        onClick={() => navigate(`/${spaceSlug}/${node.slug}`)}
      >
        {/* Drag handle */}
        <button
          ref={setDragRef}
          {...attributes}
          {...listeners}
          className={cn(
            'shrink-0 p-0.5 rounded hover:bg-bg-active cursor-grab active:cursor-grabbing text-text-muted',
            showActions && !dragId ? 'opacity-100' : 'opacity-0',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </button>

        {/* Expand/collapse chevron */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className={cn('shrink-0 p-0.5 rounded hover:bg-bg-active transition-transform', !hasChildren && 'invisible')}
        >
          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronRight className="h-3 w-3" />
          </motion.div>
        </button>

        <FileText className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        <span className="truncate flex-1">{node.title}</span>

        {/* Action buttons */}
        {showActions && !dragId && (
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onCreateChild(node.id)}
              className="p-0.5 rounded hover:bg-bg-active text-text-muted hover:text-text-primary"
              title={t('pageTree.addSubpage')}
            >
              <Plus className="h-3 w-3" />
            </button>

            <DropdownMenu.Root open={menuOpen} onOpenChange={(open) => { setMenuOpen(open); if (!open) setShowActions(false); }}>
              <DropdownMenu.Trigger asChild>
                <button
                  className="p-0.5 rounded hover:bg-bg-active text-text-muted hover:text-text-primary"
                  title={t('common.actions')}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[180px] rounded-lg border border-border bg-bg-secondary p-1 shadow-xl animate-in fade-in-0 zoom-in-95"
                  sideOffset={4}
                  align="start"
                >
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md cursor-pointer outline-none"
                    onSelect={() => onCreateChild(node.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('pageTree.addSubpage')}
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md cursor-pointer outline-none"
                    onSelect={() => onMove(node.id, node.title, node.parentId)}
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    {t('pageTree.moveTo')}
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md cursor-pointer outline-none"
                    onSelect={() => onDuplicate(node.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {t('pageTree.duplicate')}
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator className="h-px bg-border my-1" />

                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-amber-400 hover:bg-amber-400/10 rounded-md cursor-pointer outline-none"
                    onSelect={() => onArchive(node.id)}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    {t('archive.archivePage')}
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-error hover:bg-error/10 rounded-md cursor-pointer outline-none"
                    onSelect={() => onDelete(node.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('common.delete')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        )}
      </div>

      {/* Drop indicator: line AFTER (only if no children or collapsed) */}
      {dropPosition === 'after' && (
        <div
          className="absolute left-0 right-0 bottom-0 z-10 h-0.5 bg-accent rounded-full"
          style={{ marginLeft: `${depth * 16 + 8}px` }}
        />
      )}

      {/* Children */}
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {node.children.map((child) => (
              <PageTreeItem
                key={child.id}
                node={child}
                spaceSlug={spaceSlug}
                depth={depth + 1}
                expandSignal={expandSignal}
                dragId={dragId}
                dropTarget={dropTarget}
                onCreateChild={onCreateChild}
                onDelete={onDelete}
                onArchive={onArchive}
                onMove={onMove}
                onDuplicate={onDuplicate}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
