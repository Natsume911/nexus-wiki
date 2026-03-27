import { type ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Menu } from 'lucide-react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useUiStore } from '@/stores/uiStore';
import { ReadingModeProvider, useReadingMode } from '@/components/ui/ReadingMode';
import { useT } from '@/i18n';

function AppLayoutInner({ children }: { children: ReactNode }) {
  const t = useT();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const { isReadingMode, toggleReadingMode } = useReadingMode();

  // Close sidebar on mobile when navigating
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    if (mq.matches && sidebarOpen) {
      // Don't auto-close on mount, only on navigation
    }
    const handler = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [setSidebarOpen, sidebarOpen]);

  return (
    <div className="flex h-full bg-bg-primary">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && !isReadingMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && !isReadingMode && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="h-full border-r border-border-primary bg-bg-secondary flex-shrink-0 overflow-hidden fixed md:relative z-40 md:z-auto"
          >
            <Sidebar />
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {!isReadingMode && <Header />}
        <main className="flex-1 overflow-y-auto">
          <div className={isReadingMode
            ? 'max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 transition-all duration-200'
            : 'max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 transition-all duration-200'
          }>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile sidebar toggle */}
      {!sidebarOpen && !isReadingMode && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed bottom-6 left-6 z-50 md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-accent text-white shadow-lg hover:bg-accent-hover transition-colors"
          aria-label={t('nav.openSidebar')}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Floating exit reading mode button */}
      <AnimatePresence>
        {isReadingMode && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={toggleReadingMode}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-bg-secondary border border-border-primary text-text-secondary text-sm shadow-lg hover:bg-bg-hover hover:text-text-primary transition-colors"
            title={t('readingMode.exitTooltip')}
          >
            <X className="h-4 w-4" />
            {t('readingMode.exit')}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ReadingModeProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ReadingModeProvider>
  );
}
