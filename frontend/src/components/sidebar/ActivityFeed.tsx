import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, FileText, Trash2, MessageSquare, Edit3 } from 'lucide-react';
import { getSpaceActivity, type ActivityItem } from '@/api/activity';
import { useT, formatRelativeTime } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';

interface ActivityFeedProps {
  spaceSlug: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; verbKey: TranslationKey; color: string }> = {
  'page-created': { icon: <FileText className="h-3.5 w-3.5" />, verbKey: 'activity.created', color: 'text-emerald-400' },
  'page-updated': { icon: <Edit3 className="h-3.5 w-3.5" />, verbKey: 'activity.updated', color: 'text-blue-400' },
  'page-deleted': { icon: <Trash2 className="h-3.5 w-3.5" />, verbKey: 'activity.deleted', color: 'text-red-400' },
  'comment-added': { icon: <MessageSquare className="h-3.5 w-3.5" />, verbKey: 'activity.commented', color: 'text-amber-400' },
};

export function ActivityFeed({ spaceSlug }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    setLoading(true);
    getSpaceActivity(spaceSlug)
      .then(setActivities)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [spaceSlug]);


  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 bg-bg-tertiary rounded" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-text-muted">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>{t('activity.noActivity')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-text-muted" />
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('activity.title')}</h3>
      </div>
      {activities.slice(0, 15).map((act, i) => {
        const config = TYPE_CONFIG[act.type] || TYPE_CONFIG['page-updated'];
        const title = act.metadata?.title || act.metadata?.pageTitle || '';
        return (
          <motion.div
            key={act.id}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-start gap-2 py-1.5 text-xs"
          >
            <span className={`mt-0.5 shrink-0 ${config.color}`}>{config.icon}</span>
            <span className="text-text-secondary leading-relaxed">
              <span className="font-medium text-text-primary">{act.user.name || act.user.email}</span>
              {' '}{t(config.verbKey)}{' '}
              {title && <span className="font-medium text-text-primary">"{title}"</span>}
            </span>
            <span className="ml-auto text-text-muted shrink-0">{formatRelativeTime(act.createdAt)}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
