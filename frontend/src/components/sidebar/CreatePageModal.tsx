import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { usePageStore } from '@/stores/pageStore';
import { useToastStore } from '@/stores/toastStore';
import { useT } from '@/i18n';

interface CreatePageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceSlug: string;
  parentId?: string;
  onCreated: (slug: string) => void;
}

export function CreatePageModal({ open, onOpenChange, spaceSlug, parentId, onCreated }: CreatePageModalProps) {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const { createPage } = usePageStore();
  const { addToast } = useToastStore();
  const t = useT();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const page = await createPage(spaceSlug, {
        title: title.trim(),
        parentId,
      });
      addToast(t('createPage.success'), 'success');
      onOpenChange(false);
      setTitle('');
      onCreated(page.slug);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('createPage.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('createPage.title')}
      description={parentId ? t('createPage.descriptionSub') : t('createPage.descriptionRoot')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{t('createPage.pageTitle')}</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('createPage.titlePlaceholder')} autoFocus />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={!title.trim() || loading}>
            {loading ? t('common.creating') : t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
