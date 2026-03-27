import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout, Plus, FileText, Star, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { CreateSpaceModal } from '@/components/sidebar/CreateSpaceModal';
import { useSpaceStore } from '@/stores/spaceStore';
import { useAuthStore } from '@/stores/authStore';
import { getFavorites, getRecentPages } from '@/api/favorites';
import { useT, formatDate as i18nFormatDate } from '@/i18n';

interface QuickPage {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
  space: { id: string; name: string; slug: string };
}

export function HomePage() {
  const t = useT();
  const navigate = useNavigate();
  const { spaces, loading, fetchSpaces } = useSpaceStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [createOpen, setCreateOpen] = useState(false);
  const [favorites, setFavorites] = useState<QuickPage[]>([]);
  const [recent, setRecent] = useState<QuickPage[]>([]);

  useEffect(() => {
    fetchSpaces();
    getFavorites().then(setFavorites).catch(() => {});
    getRecentPages().then(setRecent).catch(() => {});
  }, [fetchSpaces]);

  const formatDate = (dateStr: string) => {
    return i18nFormatDate(dateStr, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary">{t('home.title')}</h1>
          <p className="text-text-secondary mt-1">{t('home.subtitle')}</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('home.newSpace')}
          </Button>
        )}
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-amber-400" />
            <h2 className="font-display font-semibold text-text-primary">{t('home.favorites')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favorites.slice(0, 6).map((page) => (
              <motion.button
                key={page.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => navigate(`/${page.space.slug}/${page.slug}`)}
                className="flex items-center gap-3 p-3 rounded-lg border border-border-primary bg-bg-secondary hover:bg-bg-hover transition-colors text-left"
              >
                <FileText className="h-4 w-4 text-accent shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{page.title}</p>
                  <p className="text-xs text-text-muted">{page.space.name}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Recent pages */}
      {recent.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-text-muted" />
            <h2 className="font-display font-semibold text-text-primary">{t('home.recent')}</h2>
          </div>
          <div className="space-y-1">
            {recent.slice(0, 8).map((page) => (
              <button
                key={page.id}
                onClick={() => navigate(`/${page.space.slug}/${page.slug}`)}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
              >
                <FileText className="h-4 w-4 text-text-muted shrink-0" />
                <span className="text-sm text-text-primary truncate flex-1">{page.title}</span>
                <span className="text-xs text-text-muted shrink-0">{page.space.name}</span>
                <span className="text-xs text-text-muted shrink-0">{formatDate(page.updatedAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Spaces */}
      <div className="flex items-center gap-2 mb-3">
        <Layout className="h-4 w-4 text-text-muted" />
        <h2 className="font-display font-semibold text-text-primary">{t('home.spaces')}</h2>
      </div>

      {spaces.length === 0 ? (
        <EmptyState
          icon={<Layout className="h-6 w-6" />}
          title={t('home.noSpaces')}
          description={t('home.noSpacesDesc')}
          action={
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('home.createFirstSpace')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {spaces.map((space, i) => (
            <motion.button
              key={space.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/${space.slug}`)}
              className="flex flex-col items-start p-5 rounded-xl border border-border-primary bg-bg-secondary hover:bg-bg-hover hover:border-border-secondary transition-all text-left group"
            >
              <div className="text-2xl mb-3">{space.icon || '\ud83d\udcc2'}</div>
              <h3 className="font-display font-semibold text-text-primary group-hover:text-accent transition-colors">
                {space.name}
              </h3>
              {space.description && (
                <p className="text-sm text-text-muted mt-1 line-clamp-2">{space.description}</p>
              )}
              <div className="flex items-center gap-1.5 mt-3 text-xs text-text-muted">
                <FileText className="h-3 w-3" />
                {t('home.pageCount', { count: space._count.pages })}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <CreateSpaceModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
