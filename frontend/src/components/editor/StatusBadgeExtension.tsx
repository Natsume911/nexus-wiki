import { useState, useRef, useEffect } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useI18nStore } from '@/i18n';

// Confluence-style status badges: IN PROGRESS, DONE, TODO, etc.
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    statusBadge: {
      setStatusBadge: (text?: string, color?: string) => ReturnType;
    };
  }
}

const STATUS_COLORS: Record<string, string> = {
  grey: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  yellow: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  red: 'bg-red-500/20 text-red-300 border-red-500/30',
  purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

function StatusBadgeNodeView(props: { node: { attrs: Record<string, unknown> }; updateAttributes: (a: Record<string, unknown>) => void }) {
  const text = (props.node.attrs.text as string) || 'STATUS';
  const color = (props.node.attrs.color as string) || 'grey';
  const colorClass = STATUS_COLORS[color] || STATUS_COLORS.grey;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useI18nStore((s) => s.t);

  useEffect(() => {
    if (editing) {
      setEditValue(text);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [editing, text]);

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== text) {
      props.updateAttributes({ text: trimmed });
    }
    setEditing(false);
  };

  return (
    <NodeViewWrapper as="span" className="inline relative">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border ${colorClass} cursor-pointer`}
        contentEditable={false}
        onClick={() => {
          const colors = Object.keys(STATUS_COLORS);
          const nextIdx = (colors.indexOf(color) + 1) % colors.length;
          props.updateAttributes({ color: colors[nextIdx] });
        }}
        onDoubleClick={() => setEditing(true)}
      >
        {text}
      </span>
      {editing && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setEditing(false)} />
          <span
            className="absolute left-0 top-full mt-1 z-50 flex items-center gap-1.5 p-2 bg-bg-secondary border border-border-primary rounded-lg shadow-xl"
            contentEditable={false}
          >
            <label className="text-xs text-text-muted whitespace-nowrap">{t('editor.statusBadge.editText')}</label>
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-28 px-2 py-1 rounded border border-border-primary bg-bg-primary text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={handleSubmit}
              className="px-2 py-1 rounded bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
            >
              OK
            </button>
          </span>
        </>
      )}
    </NodeViewWrapper>
  );
}

export const StatusBadge = Node.create({
  name: 'statusBadge',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      text: { default: 'TODO' },
      color: { default: 'grey' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-status-badge]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-status-badge': '' }), HTMLAttributes.text || 'STATUS'];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StatusBadgeNodeView);
  },

  addCommands() {
    return {
      setStatusBadge:
        (text = 'TODO', color = 'grey') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { text, color } }),
    };
  },
});
