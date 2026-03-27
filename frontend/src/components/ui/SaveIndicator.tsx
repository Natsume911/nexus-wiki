import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { usePageStore } from '@/stores/pageStore';
import { useT } from '@/i18n';

function useTimeAgo(timestamp: number | null) {
  const t = useT();
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!timestamp) { setLabel(''); return; }

    const update = () => {
      const diff = Math.floor((Date.now() - timestamp) / 1000);
      if (diff < 5) setLabel(t('save.now'));
      else if (diff < 60) setLabel(t('save.secondsAgo', { count: diff }));
      else if (diff < 3600) setLabel(t('save.minutesAgo', { count: Math.floor(diff / 60) }));
      else setLabel(t('save.hoursAgo', { count: Math.floor(diff / 3600) }));
    };
    update();
    const interval = setInterval(update, 15000);
    return () => clearInterval(interval);
  }, [timestamp, t]);

  return label;
}

export function SaveIndicator() {
  const t = useT();
  const { isSaving, saveError } = usePageStore();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timeAgo = useTimeAgo(savedAt);

  // Track when saving finishes
  useEffect(() => {
    if (!isSaving && !saveError) {
      setSavedAt(Date.now());
    }
  }, [isSaving, saveError]);

  return (
    <AnimatePresence mode="wait">
      {isSaving && (
        <motion.div
          key="saving"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-1.5 text-xs text-text-muted"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('save.saving')}
        </motion.div>
      )}
      {!isSaving && !saveError && (
        <motion.div
          key="saved"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-1.5 text-xs text-success"
        >
          <Check className="h-3 w-3" />
          {t('save.saved')} {timeAgo && <span className="text-text-muted">({timeAgo})</span>}
        </motion.div>
      )}
      {saveError && (
        <motion.div
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-1.5 text-xs text-error"
        >
          <AlertCircle className="h-3 w-3" />
          {t('save.error')}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
