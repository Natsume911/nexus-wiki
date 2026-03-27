import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, Network, Shield } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { SpaceSelector } from '@/components/sidebar/SpaceSelector';
import { PageTree } from '@/components/sidebar/PageTree';
import { UserMenu } from '@/components/sidebar/UserMenu';
import { useSpaceStore } from '@/stores/spaceStore';
import { usePageStore } from '@/stores/pageStore';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/i18n';

export function Sidebar() {
  const t = useT();
  const { spaceSlug } = useParams<{ spaceSlug: string }>();
  const { currentSpace, fetchSpaces } = useSpaceStore();
  const { fetchPageTree } = usePageStore();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  useEffect(() => {
    if (spaceSlug) {
      fetchPageTree(spaceSlug);
    }
  }, [spaceSlug, fetchPageTree]);

  return (
    <div className="flex flex-col h-full w-[280px]" data-testid="sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-border-primary shrink-0">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <BookOpen className="h-5 w-5 text-accent" />
          <span className="font-display font-bold text-text-primary">Nexus</span>
        </Link>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      {/* Space selector */}
      <div className="px-3 py-2 shrink-0">
        <SpaceSelector />
      </div>

      {/* Graph view link */}
      {currentSpace && (
        <div className="px-3 pb-1 shrink-0">
          <Link
            to={`/${currentSpace.slug}/graph`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Network className="h-4 w-4" />
            <span>{t('nav.graphView')}</span>
          </Link>
        </div>
      )}

      {/* Page tree */}
      <div className="flex-1 overflow-y-auto px-2">
        {currentSpace && <PageTree />}
      </div>

      {/* Admin link */}
      {user?.role === 'ADMIN' && (
        <div className="px-3 pb-1 shrink-0">
          <Link
            to="/admin"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Shield className="h-4 w-4" />
            <span>{t('nav.admin')}</span>
          </Link>
        </div>
      )}

      {/* User menu */}
      <div className="border-t border-border-primary p-3 shrink-0">
        <UserMenu />
      </div>
    </div>
  );
}
