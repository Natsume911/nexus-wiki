import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, X, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPageTags, addTagToPage, removeTagFromPage } from '@/api/tags';
import { useToastStore } from '@/stores/toastStore';
import { useT } from '@/i18n';

interface TagItem {
  id: string;
  name: string;
  color: string | null;
}

interface TagsBarProps {
  pageId: string;
}

const TAG_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

function getTagColor(name: string, explicit?: string | null): string {
  if (explicit) return explicit;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function TagsBar({ pageId }: TagsBarProps) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const t = useT();

  useEffect(() => {
    if (!pageId) return;
    getPageTags(pageId)
      .then((data) => setTags(data as TagItem[]))
      .catch(() => {});
  }, [pageId]);

  useEffect(() => {
    if (adding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [adding]);

  const handleAdd = useCallback(async () => {
    const name = inputValue.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      const tag = await addTagToPage(pageId, name) as TagItem;
      setTags((prev) => [...prev, tag]);
      setInputValue('');
      setAdding(false);
    } catch {
      addToast(t('tag.addError'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [pageId, inputValue, submitting, addToast]);

  const handleRemove = useCallback(async (tagId: string) => {
    try {
      await removeTagFromPage(pageId, tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch {
      addToast(t('tag.removeError'), 'error');
    }
  }, [pageId, addToast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      setAdding(false);
      setInputValue('');
    }
  };

  const handleTagClick = (tagId: string) => {
    navigate(`/?tag=${tagId}`);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-border-primary">
      <Tag className="h-3.5 w-3.5 text-text-muted shrink-0" />

      <AnimatePresence mode="popLayout">
        {tags.map((tag) => {
          const color = getTagColor(tag.name, tag.color);
          return (
            <motion.div
              key={tag.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: `${color}15`,
                color: color,
                border: `1px solid ${color}30`,
              }}
              onClick={() => handleTagClick(tag.id)}
            >
              <span>{tag.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(tag.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10 rounded-full p-0.5 -mr-1"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {adding ? (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          className="inline-flex"
        >
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!inputValue.trim()) {
                setAdding(false);
              }
            }}
            placeholder={t('tag.placeholder')}
            className="h-7 w-28 rounded-full border border-border-primary bg-bg-secondary px-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent"
          />
        </motion.div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-text-muted hover:text-text-secondary hover:bg-bg-hover border border-dashed border-border-primary transition-colors"
        >
          <Plus className="h-3 w-3" />
          {t('tag.addTag')}
        </button>
      )}
    </div>
  );
}
