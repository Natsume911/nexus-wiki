import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useI18nStore } from '@/i18n';

interface VersionDiffProps {
  oldContent: unknown;
  newContent: unknown;
  oldTitle: string;
  newTitle: string;
}

type DiffLine = {
  type: 'equal' | 'add' | 'remove';
  text: string;
};

/**
 * Extract plain text from TipTap JSON content.
 * Recursively walks the doc tree and collects text from paragraph/heading/etc nodes.
 */
function extractText(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const doc = content as Record<string, unknown>;

  if (doc.type === 'text' && typeof doc.text === 'string') {
    return doc.text;
  }

  const children = doc.content as unknown[] | undefined;
  if (!Array.isArray(children)) return '';

  const lines: string[] = [];
  for (const child of children) {
    const node = child as Record<string, unknown>;
    const nodeType = node.type as string;
    const innerContent = node.content as unknown[] | undefined;

    // Extract text from node
    let text = '';
    if (Array.isArray(innerContent)) {
      text = innerContent
        .map((c) => {
          const cc = c as Record<string, unknown>;
          if (cc.type === 'text') return cc.text as string;
          return extractText(cc);
        })
        .join('');
    }

    // For block-level nodes, push each as a separate line
    if (['paragraph', 'heading', 'codeBlock', 'blockquote', 'listItem', 'taskItem'].includes(nodeType)) {
      lines.push(text);
    } else if (nodeType === 'bulletList' || nodeType === 'orderedList' || nodeType === 'taskList') {
      // Recurse into list
      const listText = extractText(node);
      if (listText) lines.push(...listText.split('\n'));
    } else if (nodeType === 'table') {
      const tableText = extractText(node);
      if (tableText) lines.push(...tableText.split('\n'));
    } else if (nodeType === 'tableRow') {
      const rowCells: string[] = [];
      if (Array.isArray(innerContent)) {
        for (const cell of innerContent) {
          rowCells.push(extractText(cell));
        }
      }
      lines.push(rowCells.join(' | '));
    } else if (text) {
      lines.push(text);
    }
  }

  return lines.join('\n');
}

/**
 * Simple LCS-based diff algorithm.
 * Computes the longest common subsequence between two arrays of strings,
 * then produces a list of diff lines.
 */
function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'equal', text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', text: newLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'remove', text: oldLines[i - 1] });
      i--;
    }
  }

  return result;
}

export function VersionDiff({ oldContent, newContent, oldTitle, newTitle }: VersionDiffProps) {
  const diff = useMemo(() => {
    const oldText = extractText(oldContent);
    const newText = extractText(newContent);
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    return computeDiff(oldLines, newLines);
  }, [oldContent, newContent]);

  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const line of diff) {
      if (line.type === 'add') additions++;
      if (line.type === 'remove') deletions++;
    }
    return { additions, deletions };
  }, [diff]);

  // Split diff into old-panel lines and new-panel lines for side-by-side view
  const { oldPanelLines, newPanelLines } = useMemo(() => {
    const oldPanel: { type: 'equal' | 'remove' | 'empty'; text: string; lineNum: number | null }[] = [];
    const newPanel: { type: 'equal' | 'add' | 'empty'; text: string; lineNum: number | null }[] = [];
    let oldNum = 0;
    let newNum = 0;

    for (const line of diff) {
      if (line.type === 'equal') {
        oldNum++;
        newNum++;
        oldPanel.push({ type: 'equal', text: line.text, lineNum: oldNum });
        newPanel.push({ type: 'equal', text: line.text, lineNum: newNum });
      } else if (line.type === 'remove') {
        oldNum++;
        oldPanel.push({ type: 'remove', text: line.text, lineNum: oldNum });
        newPanel.push({ type: 'empty', text: '', lineNum: null });
      } else {
        newNum++;
        oldPanel.push({ type: 'empty', text: '', lineNum: null });
        newPanel.push({ type: 'add', text: line.text, lineNum: newNum });
      }
    }

    return { oldPanelLines: oldPanel, newPanelLines: newPanel };
  }, [diff]);

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-tertiary/50">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-text-primary">Confronto versioni</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
              +{stats.additions} aggiunte
            </span>
            <span className="text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
              -{stats.deletions} rimosse
            </span>
          </div>
        </div>
      </div>

      {/* Two-panel diff view */}
      <div className="grid grid-cols-2 divide-x divide-border-primary">
        {/* Left panel - old version */}
        <div>
          <div className="px-4 py-2 border-b border-border-primary bg-red-400/5">
            <span className="text-xs font-medium text-red-400">{oldTitle}</span>
          </div>
          <div className="font-mono text-xs overflow-x-auto">
            {oldPanelLines.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex min-h-[24px]',
                  line.type === 'remove' && 'bg-red-400/10',
                  line.type === 'empty' && 'bg-bg-tertiary/30',
                )}
              >
                <span className="w-10 shrink-0 text-right pr-2 py-0.5 text-text-muted/50 select-none border-r border-border-primary">
                  {line.lineNum ?? ''}
                </span>
                <span
                  className={cn(
                    'flex-1 px-3 py-0.5 whitespace-pre-wrap break-words',
                    line.type === 'remove' && 'text-red-300',
                    line.type === 'equal' && 'text-text-secondary',
                  )}
                >
                  {line.type === 'remove' && <span className="text-red-400 mr-1">-</span>}
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel - new version */}
        <div>
          <div className="px-4 py-2 border-b border-border-primary bg-green-400/5">
            <span className="text-xs font-medium text-green-400">{newTitle}</span>
          </div>
          <div className="font-mono text-xs overflow-x-auto">
            {newPanelLines.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex min-h-[24px]',
                  line.type === 'add' && 'bg-green-400/10',
                  line.type === 'empty' && 'bg-bg-tertiary/30',
                )}
              >
                <span className="w-10 shrink-0 text-right pr-2 py-0.5 text-text-muted/50 select-none border-r border-border-primary">
                  {line.lineNum ?? ''}
                </span>
                <span
                  className={cn(
                    'flex-1 px-3 py-0.5 whitespace-pre-wrap break-words',
                    line.type === 'add' && 'text-green-300',
                    line.type === 'equal' && 'text-text-secondary',
                  )}
                >
                  {line.type === 'add' && <span className="text-green-400 mr-1">+</span>}
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer summary */}
      {diff.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-text-muted">
          {useI18nStore.getState().t('versionDiff.noDiff')}
        </div>
      )}
    </div>
  );
}
