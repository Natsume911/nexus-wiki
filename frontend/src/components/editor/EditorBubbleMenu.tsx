import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Strikethrough, Code, Highlighter,
  Link, Unlink, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Palette, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { AiMenu } from './AiMenu';

const TEXT_COLORS = [
  { nameKey: 'editor.color.default' as const, value: '' },
  { nameKey: 'editor.color.grey' as const, value: '#9ca3af' },
  { nameKey: 'editor.color.red' as const, value: '#ef4444' },
  { nameKey: 'editor.color.orange' as const, value: '#f97316' },
  { nameKey: 'editor.color.yellow' as const, value: '#eab308' },
  { nameKey: 'editor.color.green' as const, value: '#22c55e' },
  { nameKey: 'editor.color.blue' as const, value: '#3b82f6' },
  { nameKey: 'editor.color.purple' as const, value: '#a855f7' },
  { nameKey: 'editor.color.pink' as const, value: '#ec4899' },
];

function BubbleButton({ active, onClick, children, title }: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-accent/20 text-text-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
      )}
    >
      {children}
    </button>
  );
}

export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showColors, setShowColors] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const iconSize = 'h-3.5 w-3.5';
  const t = useT();

  const updatePosition = useCallback(() => {
    const { from, to } = editor.state.selection;
    if (from === to || editor.isActive('codeBlock')) {
      setVisible(false);
      setShowColors(false);
      setShowLinkInput(false);
      setShowAi(false);
      return;
    }

    // Get the coordinates of the selection
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    const editorEl = editor.view.dom.closest('.tiptap') || editor.view.dom;
    const editorRect = editorEl.getBoundingClientRect();

    const centerX = (start.left + end.left) / 2;
    const top = start.top - editorRect.top - 45;
    const left = centerX - editorRect.left;

    setPosition({ top, left });
    setVisible(true);
  }, [editor]);

  useEffect(() => {
    editor.on('selectionUpdate', updatePosition);
    editor.on('blur', () => {
      // Delay to allow clicks on the menu itself
      setTimeout(() => {
        if (!menuRef.current?.contains(document.activeElement)) {
          setVisible(false);
          setShowColors(false);
          setShowLinkInput(false);
          setShowAi(false);
        }
      }, 200);
    });

    return () => {
      editor.off('selectionUpdate', updatePosition);
    };
  }, [editor, updatePosition]);

  const setLink = useCallback(() => {
    if (linkUrl.trim()) {
      const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().setLink({ href: url }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  if (!visible) return null;

  const currentColor = editor.getAttributes('textStyle')?.color || '';

  return (
    <div
      ref={menuRef}
      className="absolute z-50 pointer-events-auto"
      style={{ top: position.top, left: position.left, transform: 'translateX(-50%)' }}
    >
      <div className="flex items-center gap-0.5 bg-bg-tertiary border border-border-primary rounded-lg shadow-2xl px-1 py-0.5 whitespace-nowrap" role="toolbar" aria-label={t('editor.bubble.toolbar')}>
        {showLinkInput ? (
          <div className="flex items-center gap-1 px-1">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); setLink(); }
                if (e.key === 'Escape') { setShowLinkInput(false); setLinkUrl(''); }
              }}
              placeholder="https://..."
              autoFocus
              className="bg-transparent border-none outline-none text-text-primary text-sm w-48 placeholder:text-text-muted"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={setLink}
              className="px-2 py-1 text-xs font-medium rounded bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              {t('common.confirm')}
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setShowLinkInput(false); setLinkUrl(''); }}
              className="px-1.5 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        ) : showColors ? (
          <div className="flex items-center gap-0.5 px-1">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.nameKey}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (color.value) {
                    editor.chain().focus().setColor(color.value).run();
                  } else {
                    editor.chain().focus().unsetColor().run();
                  }
                  setShowColors(false);
                }}
                title={t(color.nameKey)}
                className={cn(
                  'w-5 h-5 rounded-full border transition-transform hover:scale-125',
                  currentColor === color.value ? 'border-accent scale-110' : 'border-border-primary',
                )}
                style={{
                  backgroundColor: color.value || 'transparent',
                  ...(color.value === '' ? { background: 'linear-gradient(135deg, #e8e8ed 50%, transparent 50%)' } : {}),
                }}
              />
            ))}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowColors(false)}
              className="ml-1 px-1.5 py-0.5 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              ←
            </button>
          </div>
        ) : (
          <>
            {/* AI Button */}
            <BubbleButton
              title={t('editor.bubble.nexusAi')}
              active={showAi}
              onClick={() => setShowAi(!showAi)}
            >
              <Sparkles className={cn(iconSize, 'text-violet-400')} />
            </BubbleButton>

            <div className="w-px h-4 bg-border-primary mx-0.5" />

            <BubbleButton title={t('editor.toolbar.bold')} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold className={iconSize} />
            </BubbleButton>
            <BubbleButton title={t('editor.toolbar.italic')} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic className={iconSize} />
            </BubbleButton>
            <BubbleButton title={t('editor.toolbar.underline')} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
              <Underline className={iconSize} />
            </BubbleButton>
            <BubbleButton title={t('editor.toolbar.strikethrough')} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
              <Strikethrough className={iconSize} />
            </BubbleButton>
            <BubbleButton title={t('editor.bubble.code')} active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
              <Code className={iconSize} />
            </BubbleButton>
            <BubbleButton title={t('editor.toolbar.highlight')} active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>
              <Highlighter className={iconSize} />
            </BubbleButton>

            <div className="w-px h-4 bg-border-primary mx-0.5" />

            <BubbleButton
              title={t('editor.toolbar.textColor')}
              active={!!currentColor}
              onClick={() => setShowColors(true)}
            >
              <div className="relative">
                <Palette className={iconSize} />
                {currentColor && (
                  <div
                    className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundColor: currentColor }}
                  />
                )}
              </div>
            </BubbleButton>

            <div className="w-px h-4 bg-border-primary mx-0.5" />

            {editor.isActive('link') ? (
              <BubbleButton title={t('editor.bubble.removeLink')} active onClick={() => editor.chain().focus().unsetLink().run()}>
                <Unlink className={iconSize} />
              </BubbleButton>
            ) : (
              <BubbleButton title={t('editor.bubble.insertLink')} onClick={() => {
                setLinkUrl('');
                setShowLinkInput(true);
              }}>
                <Link className={iconSize} />
              </BubbleButton>
            )}

            <div className="w-px h-4 bg-border-primary mx-0.5" />

            <BubbleButton title={t('editor.bubble.left')} active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
              <AlignLeft className={iconSize} />
            </BubbleButton>
            <BubbleButton title={t('editor.bubble.center')} active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
              <AlignCenter className={iconSize} />
            </BubbleButton>
            <BubbleButton title={t('editor.bubble.right')} active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
              <AlignRight className={iconSize} />
            </BubbleButton>
            <BubbleButton title={t('editor.toolbar.justify')} active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
              <AlignJustify className={iconSize} />
            </BubbleButton>
          </>
        )}
      </div>

      {/* AI Dropdown Menu */}
      {showAi && (
        <div className="absolute top-full left-0 mt-1">
          <AiMenu editor={editor} onClose={() => { setShowAi(false); setVisible(false); }} />
        </div>
      )}
    </div>
  );
}
