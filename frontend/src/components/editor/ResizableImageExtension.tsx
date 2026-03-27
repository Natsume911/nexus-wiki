import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useRef, useState, useCallback } from 'react';

function ResizableImageView(props: any) {
  const { node, updateAttributes, selected } = props;
  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);

  const startResize = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = imgRef.current?.offsetWidth || 300;
    const aspectRatio = (imgRef.current?.naturalHeight || 1) / (imgRef.current?.naturalWidth || 1);

    setResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const multiplier = direction.includes('left') ? -1 : 1;
      const newWidth = Math.max(100, startWidth + diff * multiplier);
      updateAttributes({ width: Math.round(newWidth) });
    };

    const onMouseUp = () => {
      setResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [updateAttributes]);

  const width = node.attrs.width;
  const handleClass = 'absolute w-3 h-3 bg-accent rounded-full border-2 border-bg-primary opacity-0 group-hover:opacity-100 transition-opacity z-10';

  return (
    <NodeViewWrapper className="inline-block">
      <div
        className={`relative inline-block group ${selected ? 'ring-2 ring-accent/40 rounded-lg' : ''} ${resizing ? 'select-none' : ''}`}
        style={{ width: width ? `${width}px` : undefined }}
      >
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || undefined}
          style={{ width: width ? `${width}px` : '100%', height: 'auto' }}
          className="rounded-lg max-w-full"
          draggable={false}
        />
        {/* Resize handles */}
        <div
          className={`${handleClass} -right-1.5 top-1/2 -translate-y-1/2 cursor-e-resize`}
          onMouseDown={(e) => startResize(e, 'right')}
        />
        <div
          className={`${handleClass} -left-1.5 top-1/2 -translate-y-1/2 cursor-w-resize`}
          onMouseDown={(e) => startResize(e, 'left')}
        />
        <div
          className={`${handleClass} -bottom-1.5 right-1/2 translate-x-1/2 cursor-s-resize`}
          onMouseDown={(e) => startResize(e, 'right')}
        />
        {/* Size indicator */}
        {(selected || resizing) && width && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-text-muted bg-bg-secondary px-2 py-0.5 rounded-md border border-border-primary whitespace-nowrap">
            {width}px
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Node.create({
  name: 'image',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      height: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },

  addCommands() {
    return {
      setImage: (attrs) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs,
        });
      },
    };
  },
});
