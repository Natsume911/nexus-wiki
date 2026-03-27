import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface ReadingModeContextType {
  isReadingMode: boolean;
  toggleReadingMode: () => void;
}

const ReadingModeContext = createContext<ReadingModeContextType>({
  isReadingMode: false,
  toggleReadingMode: () => {},
});

export function useReadingMode() {
  return useContext(ReadingModeContext);
}

export function ReadingModeProvider({ children }: { children: ReactNode }) {
  const [isReadingMode, setIsReadingMode] = useState(false);

  const toggleReadingMode = useCallback(() => {
    setIsReadingMode(prev => !prev);
  }, []);

  // Keyboard shortcut: Ctrl+Shift+F for focus/reading mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        toggleReadingMode();
      }
      // Escape exits reading mode
      if (e.key === 'Escape' && isReadingMode) {
        setIsReadingMode(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isReadingMode, toggleReadingMode]);

  return (
    <ReadingModeContext.Provider value={{ isReadingMode, toggleReadingMode }}>
      {children}
    </ReadingModeContext.Provider>
  );
}
