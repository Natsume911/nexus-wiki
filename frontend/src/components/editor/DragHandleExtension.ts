import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { NodeSelection } from '@tiptap/pm/state';

/**
 * Adds a drag handle (⠿) to the left of each top-level block.
 * Hovering shows the handle; clicking selects the block; dragging moves it.
 */
export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    let handle: HTMLDivElement | null = null;
    let currentBlockPos: number | null = null;
    const editorView = this.editor.view;

    const createHandle = () => {
      const el = document.createElement('div');
      el.className = 'nexus-drag-handle';
      el.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/></svg>';
      el.draggable = true;
      el.setAttribute('data-drag-handle', 'true');

      el.addEventListener('mousedown', (e) => {
        if (currentBlockPos === null) return;
        e.preventDefault();
        // Select the node at this position
        const tr = editorView.state.tr;
        const resolved = tr.doc.resolve(currentBlockPos);
        const nodeSelection = NodeSelection.create(tr.doc, resolved.before(1));
        editorView.dispatch(tr.setSelection(nodeSelection));
      });

      el.addEventListener('dragstart', (e) => {
        if (currentBlockPos === null) return;
        // Set up ProseMirror-compatible drag
        const tr = editorView.state.tr;
        const resolved = tr.doc.resolve(currentBlockPos);
        const nodeSelection = NodeSelection.create(tr.doc, resolved.before(1));
        editorView.dispatch(tr.setSelection(nodeSelection));

        // Let ProseMirror handle the actual drag
        const slice = nodeSelection.content();
        e.dataTransfer?.setData('text/plain', '');
        (editorView as any).dragging = {
          slice,
          move: true,
        };
      });

      return el;
    };

    const showHandle = (blockEl: HTMLElement, pos: number) => {
      if (!handle) {
        handle = createHandle();
        const editorEl = editorView.dom.parentElement;
        if (editorEl) {
          editorEl.style.position = 'relative';
          editorEl.appendChild(handle);
        }
      }

      currentBlockPos = pos;
      const editorRect = editorView.dom.getBoundingClientRect();
      const blockRect = blockEl.getBoundingClientRect();

      handle.style.top = `${blockRect.top - editorRect.top + editorView.dom.scrollTop}px`;
      handle.style.left = '-28px';
      handle.style.opacity = '1';
    };

    const hideHandle = () => {
      if (handle) {
        handle.style.opacity = '0';
      }
      currentBlockPos = null;
    };

    return [
      new Plugin({
        key: new PluginKey('dragHandle'),
        props: {
          handleDOMEvents: {
            mousemove: (view, event) => {
              const target = event.target as HTMLElement;

              // Don't show handle on the drag handle itself
              if (target.closest('[data-drag-handle]')) return false;

              const editorEl = view.dom;
              if (!editorEl.contains(target)) {
                hideHandle();
                return false;
              }

              // Find the top-level block element
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (!pos) {
                hideHandle();
                return false;
              }

              const resolved = view.state.doc.resolve(pos.pos);
              const depth = resolved.depth;
              if (depth < 1) {
                hideHandle();
                return false;
              }

              const topLevelPos = resolved.before(1);
              const domNode = view.nodeDOM(topLevelPos);

              if (domNode instanceof HTMLElement) {
                showHandle(domNode, pos.pos);
              } else {
                hideHandle();
              }

              return false;
            },
            mouseleave: () => {
              // Delay hiding so user can reach the handle
              setTimeout(() => {
                if (!handle?.matches(':hover')) {
                  hideHandle();
                }
              }, 200);
              return false;
            },
          },
        },
      }),
    ];
  },
});
