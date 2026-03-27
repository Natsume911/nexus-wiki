/**
 * Simple diff utility for comparing TipTap document versions.
 * Extracts text blocks, runs LCS-based diff, supports word-level granularity.
 */

export interface DiffBlock {
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  oldText?: string;
  newText?: string;
  text?: string;
  words?: DiffWord[];
}

export interface DiffWord {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

/** Extract flat text blocks from a TipTap JSON document */
export function extractBlocks(doc: any): string[] {
  const blocks: string[] = [];
  if (!doc?.content) return blocks;

  const blockTypes = new Set([
    'paragraph', 'heading', 'codeBlock', 'blockquote',
    'listItem', 'taskItem', 'callout',
  ]);

  function walkNode(node: any): void {
    if (!node) return;

    if (blockTypes.has(node.type)) {
      const text = extractText(node);
      if (text.trim()) {
        const prefix = node.type === 'heading' ? '#'.repeat(node.attrs?.level || 1) + ' ' : '';
        blocks.push(prefix + text);
      }
      return;
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walkNode(child);
      }
    }
  }

  for (const node of doc.content) {
    walkNode(node);
  }
  return blocks;
}

/** Recursively extract text from a node */
function extractText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  if (!node.content) return '';
  return node.content.map(extractText).join('');
}

/** LCS table for two string arrays */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [];
    for (let j = 0; j <= n; j++) {
      dp[i]![j] = 0;
    }
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }
  return dp;
}

/** Block-level diff using LCS */
export function diffBlocks(oldDoc: any, newDoc: any): DiffBlock[] {
  const oldBlocks = extractBlocks(oldDoc);
  const newBlocks = extractBlocks(newDoc);

  const dp = lcsTable(oldBlocks, newBlocks);
  const stack: DiffBlock[] = [];

  let i = oldBlocks.length;
  let j = newBlocks.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldBlocks[i - 1] === newBlocks[j - 1]) {
      stack.push({ type: 'unchanged', text: oldBlocks[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      stack.push({ type: 'added', text: newBlocks[j - 1] });
      j--;
    } else if (i > 0) {
      stack.push({ type: 'removed', text: oldBlocks[i - 1] });
      i--;
    } else {
      break;
    }
  }

  stack.reverse();

  // Merge adjacent remove+add into 'modified' with word diff
  const result: DiffBlock[] = [];
  for (let k = 0; k < stack.length; k++) {
    const current = stack[k]!;
    const next = k + 1 < stack.length ? stack[k + 1] : undefined;
    if (current.type === 'removed' && next && next.type === 'added') {
      result.push({
        type: 'modified',
        oldText: current.text ?? '',
        newText: next.text ?? '',
        words: diffWords(current.text ?? '', next.text ?? ''),
      });
      k++;
    } else {
      result.push(current);
    }
  }

  return result;
}

/** Word-level diff for modified blocks */
export function diffWords(oldText: string, newText: string): DiffWord[] {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);

  const dp = lcsTable(oldWords, newWords);
  const stack: DiffWord[] = [];

  let i = oldWords.length;
  let j = newWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      stack.push({ type: 'unchanged', text: oldWords[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      stack.push({ type: 'added', text: newWords[j - 1]! });
      j--;
    } else if (i > 0) {
      stack.push({ type: 'removed', text: oldWords[i - 1]! });
      i--;
    } else {
      break;
    }
  }

  stack.reverse();
  return stack;
}

/** Tokenize text into words (preserving spaces) */
function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) || [];
}

/** Row for split (side-by-side) diff view */
export interface SplitRow {
  left: string | null;
  right: string | null;
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  leftWords?: DiffWord[];
  rightWords?: DiffWord[];
}

/** Convert block-level diff to aligned rows for split view */
export function alignDiffForSplit(blocks: DiffBlock[]): SplitRow[] {
  const rows: SplitRow[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'unchanged':
        rows.push({ left: block.text ?? '', right: block.text ?? '', type: 'unchanged' });
        break;
      case 'removed':
        rows.push({ left: block.text ?? '', right: null, type: 'removed' });
        break;
      case 'added':
        rows.push({ left: null, right: block.text ?? '', type: 'added' });
        break;
      case 'modified':
        rows.push({
          left: block.oldText ?? '',
          right: block.newText ?? '',
          type: 'modified',
          leftWords: block.words?.filter(w => w.type !== 'added'),
          rightWords: block.words?.filter(w => w.type !== 'removed'),
        });
        break;
    }
  }
  return rows;
}
