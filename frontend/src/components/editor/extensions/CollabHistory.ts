import { Extension } from '@tiptap/core';
import { yUndoPlugin, undo, redo } from 'y-prosemirror';

/**
 * Collaborative undo/redo using Yjs UndoManager.
 * Tracks only the current user's changes — undoing won't affect other users' edits.
 */
export const CollabHistory = Extension.create({
  name: 'collabHistory',

  addProseMirrorPlugins() {
    return [yUndoPlugin()];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-z': () => undo(this.editor.state),
      'Mod-y': () => redo(this.editor.state),
      'Mod-Shift-z': () => redo(this.editor.state),
    };
  },
});
