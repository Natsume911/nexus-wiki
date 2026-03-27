import { useState, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Minus, Link, Table,
  Highlighter, Undo, Redo, Mic, Paperclip,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { useT } from '@/i18n';

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

function ToolbarButton({ active, onClick, children, title }: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded-md transition-colors',
        active
          ? 'bg-accent/20 text-accent'
          : 'text-text-muted hover:text-text-primary hover:bg-bg-hover',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border-primary mx-1" />;
}

function ColorPicker({ editor, iconSize }: { editor: Editor; iconSize: string }) {
  const [open, setOpen] = useState(false);
  const currentColor = editor.getAttributes('textStyle')?.color || '';
  const t = useT();

  return (
    <div className="relative">
      <ToolbarButton
        title={t('editor.toolbar.textColor')}
        active={!!currentColor}
        onClick={() => setOpen(!open)}
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
      </ToolbarButton>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 flex gap-1 p-2 bg-bg-secondary border border-border-primary rounded-lg shadow-xl">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.nameKey}
                onClick={() => {
                  if (color.value) {
                    editor.chain().focus().setColor(color.value).run();
                  } else {
                    editor.chain().focus().unsetColor().run();
                  }
                  setOpen(false);
                }}
                title={t(color.nameKey)}
                className={cn(
                  'w-5 h-5 rounded-full border transition-transform hover:scale-125',
                  currentColor === color.value ? 'border-accent scale-110' : 'border-border-primary',
                )}
                style={{
                  backgroundColor: color.value || 'transparent',
                  ...(color.value === '' ? { background: 'linear-gradient(135deg, var(--color-text-primary) 50%, transparent 50%)' } : {}),
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface EditorToolbarProps {
  editor: Editor;
  onUploadFiles?: (files: FileList) => void;
  isCollabMode?: boolean;
}

export function EditorToolbar({ editor, onUploadFiles, isCollabMode }: EditorToolbarProps) {
  const iconSize = 'h-4 w-4';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkPromptOpen, setLinkPromptOpen] = useState(false);
  const t = useT();

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border-primary bg-bg-secondary/50 flex-wrap">
      <ToolbarButton title={t('editor.toolbar.undo')} onClick={() => editor.chain().focus().undo().run()}>
        <Undo className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.redo')} onClick={() => editor.chain().focus().redo().run()}>
        <Redo className={iconSize} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title={t('editor.toolbar.bold')} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.italic')} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.underline')} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.strikethrough')} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.highlight')} active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.inlineCode')} active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className={iconSize} />
      </ToolbarButton>
      <ColorPicker editor={editor} iconSize={iconSize} />
      <Divider />
      <ToolbarButton title={t('editor.toolbar.heading1')} active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.heading2')} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.heading3')} active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className={iconSize} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title={t('editor.toolbar.bulletList')} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.orderedList')} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.taskList')} active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <CheckSquare className={iconSize} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title={t('editor.toolbar.alignLeft')} active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.alignCenter')} active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.alignRight')} active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.justify')} active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
        <AlignJustify className={iconSize} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title={t('editor.toolbar.quote')} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.divider')} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className={iconSize} />
      </ToolbarButton>
      <ToolbarButton title={t('editor.toolbar.table')} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <Table className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        title={t('editor.toolbar.link')}
        active={editor.isActive('link')}
        onClick={() => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
          } else {
            setLinkPromptOpen(true);
          }
        }}
      >
        <Link className={iconSize} />
      </ToolbarButton>
      <PromptDialog
        open={linkPromptOpen}
        onOpenChange={setLinkPromptOpen}
        title={t('editor.toolbar.enterUrl')}
        label={t('editor.toolbar.urlLabel')}
        placeholder={t('editor.toolbar.urlPlaceholder')}
        confirmLabel={t('editor.toolbar.insert')}
        onConfirm={(url) => {
          editor.chain().focus().setLink({ href: url }).run();
        }}
      />
      {onUploadFiles && (
        <>
          <ToolbarButton
            title={t('editor.toolbar.uploadFile')}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className={iconSize} />
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                onUploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
        </>
      )}
      <Divider />
      <ToolbarButton
        title={t('editor.toolbar.meetingAi')}
        onClick={() => window.dispatchEvent(new CustomEvent('nexus:open-meeting-recorder'))}
      >
        <Mic className={iconSize} />
      </ToolbarButton>
    </div>
  );
}
