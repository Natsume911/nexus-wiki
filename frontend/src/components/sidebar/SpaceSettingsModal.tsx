import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X, Shield, UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getSpacePermissions, setPermission, removePermission, getAllUsers } from '@/api/permissions';
import type { SpacePermission, UserSummary } from '@/api/permissions';
import { useToastStore } from '@/stores/toastStore';
import { useT } from '@/i18n';
import type { Role } from '@/types';

interface SpaceSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  spaceName: string;
}

export function SpaceSettingsModal({ open, onOpenChange, spaceId, spaceName }: SpaceSettingsModalProps) {
  const [permissions, setPermissions] = useState<SpacePermission[]>([]);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('EDITOR');
  const { addToast } = useToastStore();
  const t = useT();

  useEffect(() => {
    if (open && spaceId) {
      setLoading(true);
      Promise.all([
        getSpacePermissions(spaceId),
        getAllUsers(),
      ]).then(([perms, users]) => {
        setPermissions(perms);
        setAllUsers(users);
      }).catch(() => {
        addToast(t('permissions.loadError'), 'error');
      }).finally(() => setLoading(false));
    }
  }, [open, spaceId, addToast]);

  const handleAddPermission = useCallback(async () => {
    if (!selectedUserId) return;
    try {
      const perm = await setPermission(spaceId, selectedUserId, selectedRole);
      setPermissions((prev) => {
        const existing = prev.findIndex((p) => p.userId === perm.userId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = perm;
          return updated;
        }
        return [...prev, perm];
      });
      setSelectedUserId('');
      setAddingUser(false);
      addToast(t('permissions.added'), 'success');
    } catch {
      addToast(t('permissions.addError'), 'error');
    }
  }, [spaceId, selectedUserId, selectedRole, addToast]);

  const handleChangeRole = useCallback(async (userId: string, role: Role) => {
    try {
      const perm = await setPermission(spaceId, userId, role);
      setPermissions((prev) => prev.map((p) => (p.userId === userId ? perm : p)));
    } catch {
      addToast(t('permissions.roleUpdateError'), 'error');
    }
  }, [spaceId, addToast]);

  const handleRemove = useCallback(async (userId: string) => {
    try {
      await removePermission(spaceId, userId);
      setPermissions((prev) => prev.filter((p) => p.userId !== userId));
      addToast(t('permissions.removed'), 'success');
    } catch {
      addToast(t('permissions.removeError'), 'error');
    }
  }, [spaceId, addToast]);

  const existingUserIds = new Set(permissions.map((p) => p.userId));
  const availableUsers = allUsers.filter((u) => !existingUserIds.has(u.id));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-bg-primary border border-border-primary rounded-xl shadow-2xl z-50 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              <Dialog.Title className="font-display font-semibold text-text-primary text-lg">
                {t('permissions.title', { spaceName })}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
            </Dialog.Close>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-bg-tertiary rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Existing permissions */}
              <div className="space-y-2 mb-4">
                {permissions.length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-4">{t('permissions.noPermissions')}</p>
                ) : (
                  permissions.map((perm) => (
                    <div key={perm.id} className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary">
                      <div className="h-8 w-8 rounded-full bg-bg-tertiary text-text-muted flex items-center justify-center text-xs font-medium shrink-0">
                        {(perm.user.name || perm.user.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {perm.user.name || perm.user.email}
                        </p>
                        <p className="text-xs text-text-muted truncate">{perm.user.email}</p>
                      </div>
                      <select
                        value={perm.role}
                        onChange={(e) => handleChangeRole(perm.userId, e.target.value as Role)}
                        className="text-xs rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-text-primary"
                      >
                        <option value="ADMIN">{t('admin.roles.admin')}</option>
                        <option value="EDITOR">{t('admin.roles.editor')}</option>
                        <option value="VIEWER">{t('admin.roles.viewer')}</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(perm.userId)}
                        className="text-text-muted hover:text-red-400 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {/* Add user */}
              {!addingUser ? (
                <Button variant="secondary" onClick={() => setAddingUser(true)} className="w-full gap-2">
                  <UserPlus className="h-4 w-4" />
                  {t('permissions.addUser')}
                </Button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg border border-border-primary bg-bg-secondary"
                >
                  <div className="flex gap-2 mb-2">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="flex-1 rounded-md border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary"
                    >
                      <option value="">{t('permissions.selectUser')}</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                      ))}
                    </select>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as Role)}
                      className="rounded-md border border-border-primary bg-bg-primary px-2 py-2 text-sm text-text-primary"
                    >
                      <option value="ADMIN">{t('admin.roles.admin')}</option>
                      <option value="EDITOR">{t('admin.roles.editor')}</option>
                      <option value="VIEWER">{t('admin.roles.viewer')}</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setAddingUser(false)}>{t('common.cancel')}</Button>
                    <Button size="sm" onClick={handleAddPermission} disabled={!selectedUserId}>{t('common.add')}</Button>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
