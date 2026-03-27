import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronDown, ChevronUp, Replace, CaseSensitive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import type { Editor } from '@tiptap/react';

interface FindReplaceProps {
  editor: Editor;
  onClose: () => void;
}

interface Match {
  from: number;
  to: number;
}

function findAllMatches(editor: Editor, searchText: string, caseSensitive: boolean): Match[] {
  if (!searchText) return [];
  const doc = editor.state.doc;
  const matches: Match[] = [];
  const search = caseSensitive ? searchText : searchText.toLowerCase();

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = caseSensitive ? node.text : node.text.toLowerCase();
    let idx = 0;
    while ((idx = text.indexOf(search, idx)) !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + searchText.length });
      idx += search.length;
    }
  });

  return matches;
}

export function FindReplace({ editor, onClose }: FindReplaceProps) {
  const t = useT();
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const findRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    findRef.current?.focus();
  }, []);

  const doSearch = useCallback(() => {
    const matches = findAllMatches(editor, findText, matchCase);
    setAllMatches(matches);
    setCurrentIndex(matches.length > 0 ? 0 : -1);
    if (matches.length > 0) {
      editor.commands.setTextSelection(matches[0]);
      scrollToSelection();
    }
  }, [editor, findText, matchCase]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 200);
    return () => clearTimeout(timer);
  }, [doSearch]);

  const scrollToSelection = () => {
    const domEl = document.querySelector('.ProseMirror-selectednode, .ProseMirror .selection');
    if (domEl) domEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Alternative: use the editor's view
    const view = editor.view;
    const coords = view.coordsAtPos(view.state.selection.from);
    if (coords) {
      const el = document.elementFromPoint(coords.left, coords.top);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const goTo = (index: number) => {
    if (allMatches.length === 0) return;
    const i = ((index % allMatches.length) + allMatches.length) % allMatches.length;
    setCurrentIndex(i);
    editor.commands.setTextSelection(allMatches[i]);
    scrollToSelection();
  };

  const goNext = () => goTo(currentIndex + 1);
  const goPrev = () => goTo(currentIndex - 1);

  const replaceOne = () => {
    if (currentIndex < 0 || !allMatches[currentIndex]) return;
    const match = allMatches[currentIndex];
    editor.chain().focus().setTextSelection(match).deleteSelection().insertContent(replaceText).run();
    // Re-search after replace
    setTimeout(doSearch, 50);
  };

  const replaceAllFn = () => {
    if (allMatches.length === 0) return;
    // Replace from end to start to preserve positions
    const sorted = [...allMatches].sort((a, b) => b.from - a.from);
    editor.chain().focus();
    const tr = editor.state.tr;
    for (const m of sorted) {
      tr.replaceWith(m.from, m.to, replaceText ? editor.state.schema.text(replaceText) : editor.state.schema.text(''));
    }
    editor.view.dispatch(tr);
    setAllMatches([]);
    setCurrentIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      goNext();
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      goPrev();
    }
  };

  return (
    <div className="sticky top-0 z-20 flex flex-col gap-2 px-4 py-2.5 bg-bg-secondary/95 backdrop-blur border-b border-border-primary rounded-t-lg">
      <div className="flex items-center gap-2">
        <input
          ref={findRef}
          type="text"
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('findReplace.find')}
          className="flex-1 h-7 px-2.5 text-xs bg-bg-primary border border-border-primary rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <span className="text-[10px] text-text-muted w-16 text-center shrink-0">
          {findText ? (allMatches.length > 0 ? t('findReplace.count', { current: String(currentIndex + 1), total: String(allMatches.length) }) : t('findReplace.noResults')) : ''}
        </span>
        <button onClick={goPrev} disabled={allMatches.length === 0} className="p-1 rounded hover:bg-bg-hover disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5 text-text-muted" /></button>
        <button onClick={goNext} disabled={allMatches.length === 0} className="p-1 rounded hover:bg-bg-hover disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5 text-text-muted" /></button>
        <button onClick={() => setMatchCase(!matchCase)} className={cn('p-1 rounded', matchCase ? 'bg-accent/20 text-accent' : 'hover:bg-bg-hover text-text-muted')} title={t('findReplace.matchCase')}><CaseSensitive className="h-3.5 w-3.5" /></button>
        <button onClick={() => setShowReplace(!showReplace)} className={cn('p-1 rounded', showReplace ? 'bg-accent/20 text-accent' : 'hover:bg-bg-hover text-text-muted')}><Replace className="h-3.5 w-3.5" /></button>
        <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted"><X className="h-3.5 w-3.5" /></button>
      </div>

      {showReplace && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('findReplace.replace')}
            className="flex-1 h-7 px-2.5 text-xs bg-bg-primary border border-border-primary rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button onClick={replaceOne} disabled={allMatches.length === 0} className="h-7 px-2.5 text-[11px] rounded-md bg-bg-tertiary border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-30">{t('findReplace.replace')}</button>
          <button onClick={replaceAllFn} disabled={allMatches.length === 0} className="h-7 px-2.5 text-[11px] rounded-md bg-bg-tertiary border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-30">{t('findReplace.replaceAll')}</button>
        </div>
      )}
    </div>
  );
}
