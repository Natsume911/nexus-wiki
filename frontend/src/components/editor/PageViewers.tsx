import { useState, useEffect } from 'react';
import { Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { get } from '@/api/client';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useT, formatRelativeTime } from '@/i18n';

interface Viewer {
  userId: string;
  name: string | null;
  email: string;
  avatar: string | null;
  viewCount: number;
  lastViewed: string;
}

interface ViewStats {
  total: number;
  unique: number;
}

export function PageViewers({ pageId }: { pageId: string }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [stats, setStats] = useState<ViewStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    get<ViewStats>(`/pages/${pageId}/views`).then(setStats).catch(() => {});
  }, [pageId]);

  useEffect(() => {
    if (expanded && !loaded) {
      get<Viewer[]>(`/pages/${pageId}/viewers`).then(v => {
        setViewers(v);
        setLoaded(true);
      }).catch(() => {});
    }
  }, [expanded, loaded, pageId]);

  // Reset on page change
  useEffect(() => {
    setExpanded(false);
    setLoaded(false);
    setViewers([]);
  }, [pageId]);

  if (!stats || stats.total === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        <Eye className="h-3.5 w-3.5" />
        <span>
          {stats.total} {stats.total === 1 ? t('pageViewers.view') : t('pageViewers.views')} · {stats.unique} {t('pageViewers.readers')}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="mt-2 ml-1 space-y-1.5 border-l-2 border-border-primary pl-3">
          {viewers.map(v => (
            <div key={v.userId} className="flex items-center gap-2 text-xs">
              <UserAvatar name={v.name} email={v.email} avatar={v.avatar} size="xs" />
              <span className="text-text-secondary truncate">{v.name || v.email}</span>
              <span className="text-text-muted shrink-0">×{v.viewCount}</span>
              <span className="text-text-muted shrink-0 ml-auto">{formatRelativeTime(v.lastViewed)}</span>
            </div>
          ))}
          {viewers.length === 0 && loaded && (
            <p className="text-xs text-text-muted">{t('common.loading')}</p>
          )}
        </div>
      )}
    </div>
  );
}
