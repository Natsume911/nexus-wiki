import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useEffect, useRef } from 'react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathBlock: {
      setMathBlock: () => ReturnType;
    };
    mathInline: {
      setMathInline: () => ReturnType;
    };
  }
}

function renderKatex(container: HTMLElement, tex: string, displayMode: boolean) {
  import('katex').then((katex) => {
    try {
      katex.default.render(tex, container, { displayMode, throwOnError: false, output: 'htmlAndMathml' });
    } catch {
      container.textContent = tex;
    }
  });
}

function MathBlockNodeView(props: { node: { attrs: Record<string, unknown> }; updateAttributes: (a: Record<string, unknown>) => void }) {
  const tex = (props.node.attrs.tex as string) || '';
  const [editing, setEditing] = useState(!tex);
  const renderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing && tex && renderRef.current) {
      renderKatex(renderRef.current, tex, true);
    }
  }, [tex, editing]);

  if (editing) {
    return (
      <NodeViewWrapper>
        <div className="border border-border-primary rounded-lg overflow-hidden my-3 bg-bg-secondary">
          <div className="flex items-center justify-between px-3 py-1.5 bg-bg-tertiary text-xs text-text-muted border-b border-border-primary">
            <span>Formula Matematica (LaTeX)</span>
            <button className="text-accent hover:text-accent-hover text-xs font-medium" onClick={() => setEditing(false)}>
              Anteprima
            </button>
          </div>
          <textarea
            className="w-full p-3 bg-transparent text-text-primary font-mono text-sm resize-y min-h-[60px] outline-none"
            value={tex}
            onChange={(e) => props.updateAttributes({ tex: e.target.value })}
            placeholder="\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}"
          />
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div
        className="border border-border-primary rounded-lg my-3 p-4 bg-bg-secondary text-center cursor-pointer"
        onDoubleClick={() => setEditing(true)}
      >
        {tex ? (
          <div ref={renderRef} className="text-text-primary text-lg" />
        ) : (
          <span className="text-text-muted text-sm">Doppio click per inserire formula</span>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function MathInlineNodeView(props: { node: { attrs: Record<string, unknown> }; updateAttributes: (a: Record<string, unknown>) => void }) {
  const tex = (props.node.attrs.tex as string) || '';
  const [editing, setEditing] = useState(!tex);
  const renderRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!editing && tex && renderRef.current) {
      renderKatex(renderRef.current, tex, false);
    }
  }, [tex, editing]);

  if (editing) {
    return (
      <NodeViewWrapper as="span" className="inline">
        <input
          className="inline bg-bg-tertiary border border-border-primary rounded px-1 py-0.5 text-sm font-mono text-text-primary outline-none min-w-[100px]"
          value={tex}
          onChange={(e) => props.updateAttributes({ tex: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false); }}
          placeholder="x^2"
          autoFocus
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        ref={renderRef}
        className="inline cursor-pointer text-text-primary hover:bg-accent/10 rounded px-0.5"
        onClick={() => setEditing(true)}
      />
    </NodeViewWrapper>
  );
}

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return { tex: { default: '' } };
  },

  parseHTML() {
    return [{ tag: 'div[data-math-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockNodeView);
  },

  addCommands() {
    return {
      setMathBlock: () => ({ commands }) => commands.insertContent({ type: this.name, attrs: { tex: '' } }),
    };
  },
});

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { tex: { default: '' } };
  },

  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-math-inline': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineNodeView);
  },

  addCommands() {
    return {
      setMathInline: () => ({ commands }) => commands.insertContent({ type: this.name, attrs: { tex: '' } }),
    };
  },
});
