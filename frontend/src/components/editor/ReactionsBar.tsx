import { useState, useEffect, useCallback } from 'react';
import { SmilePlus } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';
import { getReactions, toggleReaction } from '@/api/reactions';
import type { Reaction } from '@/api/reactions';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

const EMOJI_SET = ['🐧', '👍', '❤️', '🎉', '👀', '🚀', '💡'];

interface ReactionsBarProps {
  pageId: string;
}

export function ReactionsBar({ pageId }: ReactionsBarProps) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const t = useT();

  useEffect(() => {
    getReactions(pageId).then(setReactions).catch(() => {});
  }, [pageId]);

  const handleToggle = useCallback(async (emoji: string) => {
    // Optimistic update
    setReactions(prev => {
      const existing = prev.find(r => r.emoji === emoji);
      if (existing) {
        if (existing.reacted) {
          const newCount = existing.count - 1;
          return newCount <= 0
            ? prev.filter(r => r.emoji !== emoji)
            : prev.map(r => r.emoji === emoji ? { ...r, count: newCount, reacted: false } : r);
        } else {
          return prev.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r);
        }
      } else {
        return [...prev, { emoji, count: 1, reacted: true }];
      }
    });
    setPopoverOpen(false);

    try {
      const updated = await toggleReaction(pageId, emoji);
      setReactions(updated);
    } catch {
      // Refetch on error
      getReactions(pageId).then(setReactions).catch(() => {});
    }
  }, [pageId]);

  // Sort reactions by EMOJI_SET order
  const sorted = [...reactions].sort(
    (a, b) => EMOJI_SET.indexOf(a.emoji) - EMOJI_SET.indexOf(b.emoji)
  );

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1">
      <AnimatePresence mode="popLayout">
        {sorted.map(r => (
          <motion.button
            key={r.emoji}
            layout
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={() => handleToggle(r.emoji)}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors border cursor-pointer',
              r.reacted
                ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25'
                : 'bg-bg-secondary border-border-primary text-text-muted hover:bg-bg-hover hover:text-text-primary'
            )}
            title={r.reacted ? t('reactions.you') : undefined}
          >
            <span className="text-sm">{r.emoji}</span>
            <span>{r.count}</span>
          </motion.button>
        ))}
      </AnimatePresence>

      <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Popover.Trigger asChild>
          <button
            className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-dashed border-border-primary text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
            title={t('reactions.addReaction')}
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-border-primary bg-bg-secondary shadow-xl z-50"
            sideOffset={6}
          >
            {EMOJI_SET.map(emoji => {
              const already = reactions.find(r => r.emoji === emoji)?.reacted;
              return (
                <button
                  key={emoji}
                  onClick={() => handleToggle(emoji)}
                  className={cn(
                    'h-8 w-8 flex items-center justify-center rounded-md text-lg hover:bg-bg-hover transition-colors cursor-pointer',
                    already && 'bg-accent/15 ring-1 ring-accent/30'
                  )}
                >
                  {emoji}
                </button>
              );
            })}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
