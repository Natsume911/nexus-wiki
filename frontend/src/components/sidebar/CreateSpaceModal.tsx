import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useSpaceStore } from '@/stores/spaceStore';
import { useToastStore } from '@/stores/toastStore';
import { useT } from '@/i18n';

interface CreateSpaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSpaceModal({ open, onOpenChange }: CreateSpaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [loading, setLoading] = useState(false);
  const { createSpace } = useSpaceStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const t = useT();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const space = await createSpace({
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
      });
      addToast(t('createSpace.success'), 'success');
      onOpenChange(false);
      setName('');
      setDescription('');
      setIcon('');
      navigate(`/${space.slug}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('createSpace.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('createSpace.title')} description={t('createSpace.description')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{t('createSpace.name')}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('createSpace.namePlaceholder')} autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{t('createSpace.desc')}</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('createSpace.descPlaceholder')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{t('createSpace.icon')}</label>
          <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder={t('createSpace.iconPlaceholder')} className="w-20" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={!name.trim() || loading}>
            {loading ? t('common.creating') : t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
