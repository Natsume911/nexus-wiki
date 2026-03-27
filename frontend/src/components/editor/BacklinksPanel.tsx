import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Link2 } from 'lucide-react';
import { getBacklinks, Backlink } from '@/api/backlinks';
import { useT } from '@/i18n';

interface Props {
  pageId: string;
}

export function BacklinksPanel({ pageId }: Props) {
  const [links, setLinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    setLoading(true);
    getBacklinks(pageId)
      .then(setLinks)
      .catch(() => setLinks([]))
      .finally(() => setLoading(false));
  }, [pageId]);

  if (loading) return null;
  if (links.length === 0) return null;

  return (
    <div className="mt-8 pt-6 border-t border-border-primary">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="h-4 w-4 text-text-muted" />
        <h3 className="text-sm font-medium text-text-secondary">
          {t('backlink.title', { count: links.length })}
        </h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.id}
            to={`/${link.spaceSlug}/${link.slug}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-tertiary text-sm text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <ArrowUpRight className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{link.title}</span>
            <span className="text-xs text-text-muted">({link.spaceName})</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
