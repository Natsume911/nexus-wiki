import { useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { updatePageContent } from '@/api/pages';
import { usePageStore } from '@/stores/pageStore';
import { useToastStore } from '@/stores/toastStore';
import { useI18nStore } from '@/i18n';

/**
 * HTTP autosave hook.
 * In collaborative mode, this runs with a longer debounce (15s) as a safety net —
 * Hocuspocus is the primary save mechanism via WebSocket.
 * When not connected (solo editing), this is the primary save (3s debounce).
 */
export function useAutoSave(editor: Editor | null, pageId: string | undefined, collabConnected = false) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const { setSaving, setSaveError } = usePageStore();
  const { addToast } = useToastStore();

  const save = useCallback(async () => {
    if (!editor || !pageId) return;
    const content = editor.getJSON();
    setSaving(true);
    setSaveError(null);
    try {
      await updatePageContent(pageId, content);
      setSaving(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : useI18nStore.getState().t('save.error');
      setSaveError(message);
      setSaving(false);
      addToast(message, 'error');
    }
  }, [editor, pageId, setSaving, setSaveError, addToast]);

  useEffect(() => {
    if (!editor) return;

    // Collab connected → long debounce (safety net only)
    // Collab disconnected or solo → short debounce (primary save)
    const debounceMs = collabConnected ? 15000 : 3000;

    const handler = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(save, debounceMs);
    };

    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
      // Flush any pending save instead of discarding it
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        save(); // fire immediately
      }
    };
  }, [editor, save, collabConnected]);

  return { save };
}
