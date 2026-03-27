import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const pluginKey = new PluginKey('imageUpload');

export type ImageUploadFn = (file: File) => Promise<string>;

function handleImageUpload(view: EditorView, file: File, uploadFn: ImageUploadFn) {
  const { schema, tr } = view.state;
  const pos = view.state.selection.from;

  const placeholderSrc = URL.createObjectURL(file);
  const node = schema.nodes.image?.create({ src: placeholderSrc, alt: file.name, title: 'Caricamento...' });
  if (!node) return;

  view.dispatch(tr.insert(pos, node));

  uploadFn(file)
    .then((url) => {
      const { doc } = view.state;
      let found = false;
      doc.descendants((docNode, docPos) => {
        if (found) return false;
        if (docNode.type.name === 'image' && docNode.attrs.src === placeholderSrc) {
          found = true;
          const transaction = view.state.tr.setNodeMarkup(docPos, undefined, {
            ...docNode.attrs,
            src: url,
            title: null,
          });
          view.dispatch(transaction);
        }
      });
      URL.revokeObjectURL(placeholderSrc);
    })
    .catch(() => {
      const { doc } = view.state;
      doc.descendants((docNode, docPos) => {
        if (docNode.type.name === 'image' && docNode.attrs.src === placeholderSrc) {
          const transaction = view.state.tr.delete(docPos, docPos + docNode.nodeSize);
          view.dispatch(transaction);
        }
      });
      URL.revokeObjectURL(placeholderSrc);
    });
}

export const ImageUploadExtension = Extension.create<{ uploadFn: ImageUploadFn }>({
  name: 'imageUpload',

  addOptions() {
    return {
      uploadFn: async () => '',
    };
  },

  addProseMirrorPlugins() {
    const uploadFn = this.options.uploadFn;
    return [
      new Plugin({
        key: pluginKey,
        props: {
          handlePaste(view, event) {
            const items = event.clipboardData?.items;
            if (!items) return false;
            for (const item of Array.from(items)) {
              if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) handleImageUpload(view, file, uploadFn);
                return true;
              }
            }
            return false;
          },
          handleDrop(view, event) {
            const files = event.dataTransfer?.files;
            if (!files?.length) return false;
            const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
            if (!images.length) return false;
            event.preventDefault();
            for (const file of images) handleImageUpload(view, file, uploadFn);
            return true;
          },
        },
      }),
    ];
  },
});
