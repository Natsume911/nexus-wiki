import { Search, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from './Breadcrumb';
import { LanguageSelector } from './LanguageSelector';
import { useUiStore } from '@/stores/uiStore';
import { usePageStore } from '@/stores/pageStore';
import { useSpaceStore } from '@/stores/spaceStore';
import { useT } from '@/i18n';

export function Header() {
  const { sidebarOpen, toggleSidebar, setSearchOpen } = useUiStore();
  const { breadcrumbs } = usePageStore();
  const { currentSpace } = useSpaceStore();
  const t = useT();

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-border-primary bg-bg-primary/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </Button>
        {currentSpace && (
          <Breadcrumb
            spaceSlug={currentSpace.slug}
            spaceName={currentSpace.name}
            items={breadcrumbs}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSearchOpen(true)}
          className="gap-2 text-text-muted"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">{t('header.search')}</span>
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border-primary bg-bg-tertiary px-1.5 text-[10px] font-mono text-text-muted">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        <LanguageSelector />
      </div>
    </header>
  );
}
