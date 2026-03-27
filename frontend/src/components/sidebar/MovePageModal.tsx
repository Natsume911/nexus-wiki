import { useState, useMemo } from 'react';
import { ChevronRight, FileText, FolderUp } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import type { PageTreeNode } from '@/types';

interface MovePageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  pageTitle: string;
  currentParentId: string | null;
  pageTree: PageTreeNode[];
  onMove: (targetParentId: string | null) => void;
}

/** Collect all descendant IDs (to prevent circular moves) */
function getDescendantIds(tree: PageTreeNode[], pageId: string): Set<string> {
  const ids = new Set<string>();
  function findNode(nodes: PageTreeNode[]): PageTreeNode | null {
    for (const n of nodes) {
      if (n.id === pageId) return n;
      const found = findNode(n.children);
      if (found) return found;
    }
    return null;
  }
  function collectIds(nodes: PageTreeNode[]) {
    for (const n of nodes) {
      ids.add(n.id);
      collectIds(n.children);
    }
  }
  const node = findNode(tree);
  if (node?.children) collectIds(node.children);
  return ids;
}

function TreeSelector({
  nodes,
  depth,
  selected,
  onSelect,
  disabledIds,
}: {
  nodes: PageTreeNode[];
  depth: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  disabledIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <>
      {nodes.map((node) => {
        const isDisabled = disabledIds.has(node.id);
        const isSelected = selected === node.id;
        const hasChildren = node.children.length > 0;
        const isExpanded = expanded[node.id] ?? true;

        return (
          <div key={node.id}>
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onSelect(node.id)}
              className={cn(
                'flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                isDisabled && 'opacity-30 cursor-not-allowed',
                isSelected
                  ? 'bg-accent/20 text-accent ring-1 ring-accent/30'
                  : !isDisabled && 'hover:bg-bg-hover text-text-secondary hover:text-text-primary',
              )}
              style={{ paddingLeft: `${depth * 20 + 8}px` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((prev) => ({ ...prev, [node.id]: !isExpanded }));
                  }}
                  className="shrink-0 p-0.5 rounded hover:bg-bg-active"
                >
                  <ChevronRight
                    className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-90')}
                  />
                </button>
              ) : (
                <span className="w-4" />
              )}
              <FileText className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <span className="truncate">{node.title}</span>
            </button>
            {hasChildren && isExpanded && (
              <TreeSelector
                nodes={node.children}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
                disabledIds={disabledIds}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export function MovePageModal({
  open,
  onOpenChange,
  pageId,
  pageTitle,
  currentParentId,
  pageTree,
  onMove,
}: MovePageModalProps) {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(currentParentId);
  const [loading, setLoading] = useState(false);
  const t = useT();

  // Prevent moving a page under itself or its descendants
  const disabledIds = useMemo(() => {
    const ids = getDescendantIds(pageTree, pageId);
    ids.add(pageId); // Can't be its own parent
    return ids;
  }, [pageTree, pageId]);

  const isRootSelected = selectedParentId === null;
  const hasChanged = selectedParentId !== currentParentId;

  const handleConfirm = async () => {
    if (!hasChanged) return;
    setLoading(true);
    try {
      await onMove(selectedParentId);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('move.title')}
      description={t('move.description', { title: pageTitle })}
    >
      <div className="space-y-3">
        {/* Root level option */}
        <button
          type="button"
          onClick={() => setSelectedParentId(null)}
          className={cn(
            'flex items-center gap-2 w-full px-2 py-2 rounded-md text-sm transition-colors',
            isRootSelected
              ? 'bg-accent/20 text-accent ring-1 ring-accent/30'
              : 'hover:bg-bg-hover text-text-secondary hover:text-text-primary',
          )}
        >
          <FolderUp className="h-4 w-4" />
          <span className="font-medium">{t('move.rootLevel')}</span>
        </button>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Page tree */}
        <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
          <TreeSelector
            nodes={pageTree}
            depth={0}
            selected={selectedParentId}
            onSelect={setSelectedParentId}
            disabledIds={disabledIds}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!hasChanged || loading}>
            {loading ? t('move.moving') : t('move.move')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
