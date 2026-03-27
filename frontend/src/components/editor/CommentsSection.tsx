import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Pencil, Trash2, X, Check, Reply, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getComments, createComment, updateComment, deleteComment } from '@/api/comments';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { useT, formatDate as i18nFormatDate } from '@/i18n';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { Comment } from '@/types';

interface ThreadedComment extends Comment {
  replies?: Comment[];
}

interface CommentsSectionProps {
  pageId: string;
}

export function CommentsSection({ pageId }: CommentsSectionProps) {
  const [comments, setComments] = useState<ThreadedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const t = useT();

  const totalCount = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

  useEffect(() => {
    if (!pageId) return;
    setLoading(true);
    getComments(pageId)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pageId]);

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const comment = await createComment(pageId, newComment.trim());
      setComments((prev) => [comment, ...prev]);
      setNewComment('');
    } catch {
      addToast(t('comment.sendError'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [pageId, newComment, submitting, addToast, t]);

  const handleReply = useCallback(async (parentId: string) => {
    if (!replyContent.trim()) return;
    try {
      const reply = await createComment(pageId, replyContent.trim(), parentId);
      setComments((prev) => prev.map((c) => {
        if (c.id === parentId) {
          return { ...c, replies: [...(c.replies || []), reply] };
        }
        return c;
      }));
      setReplyingTo(null);
      setReplyContent('');
    } catch {
      addToast(t('comment.sendError'), 'error');
    }
  }, [pageId, replyContent, addToast, t]);

  const handleUpdate = useCallback(async (id: string) => {
    if (!editContent.trim()) return;
    try {
      const updated = await updateComment(id, editContent.trim());
      setComments((prev) => prev.map((c) => {
        if (c.id === id) return { ...c, ...updated };
        if (c.replies) {
          return { ...c, replies: c.replies.map(r => r.id === id ? { ...r, ...updated } : r) };
        }
        return c;
      }));
      setEditingId(null);
    } catch {
      addToast(t('comment.updateError'), 'error');
    }
  }, [editContent, addToast, t]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteComment(id);
      setComments((prev) => {
        // Check if it's a top-level comment
        const filtered = prev.filter((c) => c.id !== id);
        // Or a reply
        return filtered.map(c => ({
          ...c,
          replies: c.replies?.filter(r => r.id !== id),
        }));
      });
      addToast(t('comment.deleted'), 'info');
    } catch {
      addToast(t('comment.deleteError'), 'error');
    }
  }, [addToast, t]);

  const toggleThread = (id: string) => {
    setCollapsedThreads(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    return i18nFormatDate(dateStr, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <motion.div
      key={comment.id}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`flex gap-3 ${isReply ? 'mb-3' : 'mb-4'}`}
    >
      <UserAvatar name={comment.author.name} email={comment.author.email} avatar={(comment.author as any).avatar} size="md" className={isReply ? '!h-6 !w-6' : '!h-8 !w-8'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-medium text-text-primary ${isReply ? 'text-xs' : 'text-sm'}`}>{comment.author.name || comment.author.email}</span>
          <span className="text-xs text-text-muted">{formatDate(comment.createdAt)}</span>
          {comment.createdAt !== comment.updatedAt && <span className="text-xs text-text-muted">{t('comment.edited')}</span>}
        </div>

        {editingId === comment.id ? (
          <div>
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none" />
            <div className="flex gap-1 mt-1">
              <Button size="sm" variant="ghost" onClick={() => handleUpdate(comment.id)}><Check className="h-3.5 w-3.5 mr-1" /> {t('common.save')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5 mr-1" /> {t('common.cancel')}</Button>
            </div>
          </div>
        ) : (
          <div className="group">
            <p className={`text-text-secondary whitespace-pre-wrap ${isReply ? 'text-xs' : 'text-sm'}`}>{comment.content}</p>
            <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!isReply && (
                <Button size="sm" variant="ghost" className="!h-6 !px-1.5 !text-xs text-text-muted" onClick={() => { setReplyingTo(comment.id); setReplyContent(''); }}>
                  <Reply className="h-3 w-3 mr-1" /> {t('comments.reply')}
                </Button>
              )}
              {user?.id === comment.author.id && (
                <>
                  <Button size="sm" variant="ghost" className="!h-6 !px-1.5 !text-xs text-text-muted" onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}>
                    <Pencil className="h-3 w-3 mr-1" /> {t('common.edit')}
                  </Button>
                  <Button size="sm" variant="ghost" className="!h-6 !px-1.5 !text-xs text-text-muted hover:text-red-400" onClick={() => handleDelete(comment.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> {t('common.delete')}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="mt-10 border-t border-border-primary pt-8">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="h-5 w-5 text-accent" />
        <h3 className="font-display font-semibold text-text-primary">
          {t('comment.title')} {totalCount > 0 && <span className="text-text-muted font-normal">({totalCount})</span>}
        </h3>
      </div>

      {/* New comment */}
      <div className="flex gap-3 mb-6">
        <UserAvatar name={user?.name} email={user?.email} avatar={user?.avatar} size="md" className="!h-8 !w-8" />
        <div className="flex-1">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t('comment.placeholder')}
            rows={2}
            className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-text-muted">{t('comment.ctrlEnter')}</span>
            <Button size="sm" onClick={handleSubmit} disabled={!newComment.trim() || submitting}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {submitting ? t('comment.sending') : t('comment.send')}
            </Button>
          </div>
        </div>
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-bg-tertiary shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-bg-tertiary rounded" />
                <div className="h-12 bg-bg-tertiary rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {comments.map((comment) => (
            <div key={comment.id}>
              {renderComment(comment)}

              {/* Replies */}
              {(comment.replies?.length || 0) > 0 && (
                <div className="ml-11">
                  <button onClick={() => toggleThread(comment.id)} className="flex items-center gap-1 text-xs text-text-muted hover:text-accent mb-2 transition-colors">
                    {collapsedThreads.has(comment.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                    {t('comments.replies', { count: comment.replies!.length })}
                  </button>
                  {!collapsedThreads.has(comment.id) && (
                    <div className="border-l-2 border-border-primary pl-3">
                      {comment.replies!.map(reply => renderComment(reply, true))}
                    </div>
                  )}
                </div>
              )}

              {/* Reply input */}
              {replyingTo === comment.id && (
                <div className="ml-11 mb-4 flex gap-2">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={t('comments.reply') + '...'}
                    rows={1}
                    autoFocus
                    className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(comment.id); if (e.key === 'Escape') setReplyingTo(null); }}
                  />
                  <Button size="sm" className="!h-7" onClick={() => handleReply(comment.id)} disabled={!replyContent.trim()}>
                    <Send className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="!h-7" onClick={() => setReplyingTo(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </AnimatePresence>
      )}

      {!loading && comments.length === 0 && (
        <p className="text-sm text-text-muted text-center py-4">{t('comment.noComments')}</p>
      )}
    </div>
  );
}
