import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useEffect, useRef } from 'react';
import { useT } from '@/i18n';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaidBlock: {
      setMermaidBlock: () => ReturnType;
    };
  }
}

function MermaidNodeView(props: { node: { attrs: Record<string, unknown> }; updateAttributes: (attrs: Record<string, unknown>) => void }) {
  const { node, updateAttributes } = props;
  const code = (node.attrs.code as string) || '';
  const t = useT();
  const [editing, setEditing] = useState(!code);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!code || editing) return;
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || t('mermaid.diagramError'));
      }
    })();

    return () => { cancelled = true; };
  }, [code, editing]);

  if (editing) {
    return (
      <NodeViewWrapper>
        <div className="border border-border-primary rounded-lg overflow-hidden my-3 bg-bg-secondary">
          <div className="flex items-center justify-between px-3 py-1.5 bg-bg-tertiary text-xs text-text-muted border-b border-border-primary">
            <span>Mermaid Diagram</span>
            <button
              className="text-accent hover:text-accent-hover text-xs font-medium"
              onClick={() => setEditing(false)}
            >
              {t('mermaid.preview')}
            </button>
          </div>
          <textarea
            className="w-full p-3 bg-transparent text-text-primary font-mono text-sm resize-y min-h-[120px] outline-none"
            value={code}
            onChange={(e) => updateAttributes({ code: e.target.value })}
            placeholder={`graph TD\n    A[Inizio] --> B{Condizione}\n    B -->|Sì| C[Risultato 1]\n    B -->|No| D[Risultato 2]`}
          />
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div
        className="border border-border-primary rounded-lg overflow-hidden my-3 bg-bg-secondary cursor-pointer"
        onDoubleClick={() => setEditing(true)}
      >
        <div className="flex items-center justify-between px-3 py-1.5 bg-bg-tertiary text-xs text-text-muted border-b border-border-primary">
          <span>Mermaid Diagram</span>
          <button
            className="text-accent hover:text-accent-hover text-xs font-medium"
            onClick={() => setEditing(true)}
          >
            {t('mermaid.edit')}
          </button>
        </div>
        {error ? (
          <div className="p-3 text-red-400 text-sm">{error}</div>
        ) : (
          <div ref={containerRef} className="p-4 flex justify-center [&_svg]:max-w-full" />
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      code: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-mermaid]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-mermaid': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },

  addCommands() {
    return {
      setMermaidBlock:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { code: '' } }),
    };
  },
});
