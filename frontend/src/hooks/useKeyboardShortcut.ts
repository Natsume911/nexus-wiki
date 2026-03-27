import { useEffect } from 'react';

export function useKeyboardShortcut(key: string, callback: () => void, modifiers: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const metaMatch = modifiers.meta ? (e.metaKey || e.ctrlKey) : true;
      const ctrlMatch = modifiers.ctrl ? e.ctrlKey : true;
      const shiftMatch = modifiers.shift ? e.shiftKey : !e.shiftKey;

      if (e.key.toLowerCase() === key.toLowerCase() && metaMatch && ctrlMatch && shiftMatch) {
        e.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [key, callback, modifiers.meta, modifiers.ctrl, modifiers.shift]);
}
