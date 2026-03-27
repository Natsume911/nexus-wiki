import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Users,
  Layout,
  Database,
  Shield,
  Settings,
  Download,
  Trash2,
  BarChart3,
  FileText,
  Paperclip,
  MessageSquare,
  HardDrive,
  ChevronDown,
  Check,
  AlertTriangle,
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Building,
  Brain,
  DollarSign,
  Zap,
  TrendingUp,
  Upload,
  Loader2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  getAdminUsers,
  updateUserRole,
  updateUserActive,
  deleteUser,
  syncUsersFromExternal,
  getAdminStats,
  getAdminSpaces,
  downloadDbBackup,
  downloadJsonBackup,
  restoreDbBackup,
  restoreJsonBackup,
  getLlmUsage,
  type LlmUsageStats,
} from '@/api/admin';
import { getSpaces } from '@/api/spaces';
import { upload as apiUpload } from '@/api/client';
import { getAuditLogs, exportAuditCSV, type AuditLogResponse } from '@/api/audit';
import { seedTemplates } from '@/api/templates';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { useT, formatDate } from '@/i18n';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { TranslationKey } from '@/i18n/types';
import type { Role, User, Space } from '@/types';
import { NotFoundPage } from './NotFoundPage';

type AdminTab = 'dashboard' | 'utenti' | 'spazi' | 'backup' | 'audit' | 'llm' | 'import';

interface AdminStats {
  users: number;
  spaces: number;
  pages: number;
  attachments: number;
  comments: number;
  storageUsed: number;
  storageUsedFormatted: string;
}

interface AdminSpace extends Space {
  _count: { pages: number };
  permissions?: number;
}

const TABS: { key: AdminTab; labelKey: TranslationKey; icon: typeof BarChart3 }[] = [
  { key: 'dashboard', labelKey: 'admin.tabs.dashboard' as const, icon: BarChart3 },
  { key: 'utenti', labelKey: 'admin.tabs.users' as const, icon: Users },
  { key: 'spazi', labelKey: 'admin.tabs.spaces' as const, icon: Layout },
  { key: 'audit', labelKey: 'admin.tabs.audit' as const, icon: Shield },
  { key: 'backup', labelKey: 'admin.tabs.backup' as const, icon: Database },
  { key: 'llm', labelKey: 'admin.tabs.llm' as const, icon: Brain },
  { key: 'import', labelKey: 'admin.tabs.import' as const, icon: Upload },
];

const ACTION_LABEL_KEYS: Record<string, TranslationKey> = {
  CREATE: 'admin.action.create',
  UPDATE: 'admin.action.update',
  DELETE: 'admin.action.delete',
  MOVE: 'admin.action.move',
  RESTORE: 'admin.action.restore',
  LOGIN: 'admin.action.login',
  PERMISSION_GRANT: 'admin.action.permissionGrant',
  PERMISSION_REVOKE: 'admin.action.permissionRevoke',
  PERMISSION_CHANGE: 'admin.action.permissionChange',
  EXPORT: 'admin.action.export',
  IMPORT: 'admin.action.import',
  BACKUP: 'admin.action.backup',
  ROLE_CHANGE: 'admin.action.roleChange',
  REINDEX: 'admin.action.reindex',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'text-emerald-400 bg-emerald-400/10',
  UPDATE: 'text-sky-400 bg-sky-400/10',
  DELETE: 'text-red-400 bg-red-400/10',
  MOVE: 'text-amber-400 bg-amber-400/10',
  RESTORE: 'text-violet-400 bg-violet-400/10',
  LOGIN: 'text-indigo-400 bg-indigo-400/10',
  PERMISSION_GRANT: 'text-teal-400 bg-teal-400/10',
  PERMISSION_REVOKE: 'text-orange-400 bg-orange-400/10',
  PERMISSION_CHANGE: 'text-cyan-400 bg-cyan-400/10',
  EXPORT: 'text-pink-400 bg-pink-400/10',
  IMPORT: 'text-lime-400 bg-lime-400/10',
  BACKUP: 'text-yellow-400 bg-yellow-400/10',
  ROLE_CHANGE: 'text-fuchsia-400 bg-fuchsia-400/10',
  REINDEX: 'text-blue-400 bg-blue-400/10',
};

const ROLE_LABEL_KEYS: Record<Role, TranslationKey> = {
  ADMIN: 'admin.roles.admin',
  EDITOR: 'admin.roles.editor',
  VIEWER: 'admin.roles.viewer',
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'text-red-400 bg-red-400/10 border-red-400/20',
  EDITOR: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  VIEWER: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const RESOURCE_TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  PAGE: 'admin.audit.typePage',
  SPACE: 'admin.audit.typeSpace',
  USER: 'admin.audit.typeUser',
  COMMENT: 'admin.audit.typeComment',
  PERMISSION: 'admin.audit.typePermission',
  ATTACHMENT: 'admin.audit.typeAttachment',
  SYSTEM: 'admin.audit.typeSystem',
};

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [spaces, setSpaces] = useState<AdminSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreType, setRestoreType] = useState<'db' | 'json' | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [auditData, setAuditData] = useState<AuditLogResponse | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditResourceType, setAuditResourceType] = useState('');
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const { addToast } = useToastStore();
  const { user: currentUser } = useAuthStore();
  const t = useT();

  useEffect(() => {
    setLoading(true);
    const loadData = async () => {
      try {
        if (activeTab === 'dashboard') {
          const s = await getAdminStats();
          setStats(s as AdminStats);
        } else if (activeTab === 'utenti') {
          const u = await getAdminUsers();
          setUsers(u as User[]);
        } else if (activeTab === 'spazi') {
          const sp = await getAdminSpaces();
          setSpaces(sp as AdminSpace[]);
        } else if (activeTab === 'audit') {
          const data = await getAuditLogs({
            page: auditPage,
            limit: 30,
            search: auditSearch || undefined,
            action: auditAction || undefined,
            resourceType: auditResourceType || undefined,
          });
          setAuditData(data);
        }
      } catch {
        addToast(t('admin.loadError'), 'error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeTab, addToast, auditPage, auditSearch, auditAction, auditResourceType, t]);

  const handleRoleChange = useCallback(async (userId: string, role: Role) => {
    try {
      await updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      addToast(t('admin.roleUpdated'), 'success');
    } catch {
      addToast(t('admin.roleUpdateError'), 'error');
    }
  }, [addToast, t]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setDeleteConfirm(null);
      addToast(t('admin.userDeleted'), 'success');
    } catch {
      addToast(t('admin.userDeleteError'), 'error');
    }
  }, [addToast, t]);

  const handleToggleActive = useCallback(async (userId: string, active: boolean) => {
    try {
      await updateUserActive(userId, active);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active } : u)));
      addToast(active ? t('admin.userActivated') : t('admin.userDeactivated'), 'success');
    } catch {
      addToast(t('common.error'), 'error');
    }
  }, [addToast, t]);

  const handleSyncExternal = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncUsersFromExternal();
      addToast(t('admin.syncSuccess', { created: result.created, updated: result.updated }), 'success');
      // Reload users
      const u = await getAdminUsers();
      setUsers(u as User[]);
    } catch {
      addToast(t('admin.syncError'), 'error');
    } finally {
      setSyncing(false);
    }
  }, [addToast, t]);

  const handleSeedTemplates = useCallback(async () => {
    setSeeding(true);
    try {
      await seedTemplates();
      addToast(t('admin.backup.templatesCreated'), 'success');
    } catch {
      addToast(t('admin.backup.templatesError'), 'error');
    } finally {
      setSeeding(false);
    }
  }, [addToast, t]);

  const handleRestore = useCallback(async () => {
    if (!restoreFile || !restoreType || restoreConfirm !== 'RIPRISTINA') return;
    setRestoring(true);
    try {
      if (restoreType === 'db') {
        await restoreDbBackup(restoreFile);
      } else {
        await restoreJsonBackup(restoreFile);
      }
      addToast(t('admin.backup.restoreSuccess'), 'success');
      setRestoreFile(null);
      setRestoreType(null);
      setRestoreConfirm('');
    } catch (err: any) {
      addToast(t('admin.backup.restoreError', { message: err.message }), 'error');
    } finally {
      setRestoring(false);
    }
  }, [restoreFile, restoreType, restoreConfirm, addToast, t]);

  const statsCards = stats ? [
    { labelKey: 'admin.stats.users' as TranslationKey, value: stats.users, icon: Users, color: 'text-indigo-400 bg-indigo-400/10' },
    { labelKey: 'admin.stats.spaces' as TranslationKey, value: stats.spaces, icon: Layout, color: 'text-emerald-400 bg-emerald-400/10' },
    { labelKey: 'admin.stats.pages' as TranslationKey, value: stats.pages, icon: FileText, color: 'text-sky-400 bg-sky-400/10' },
    { labelKey: 'admin.stats.attachments' as TranslationKey, value: stats.attachments, icon: Paperclip, color: 'text-amber-400 bg-amber-400/10' },
    { labelKey: 'admin.stats.comments' as TranslationKey, value: stats.comments, icon: MessageSquare, color: 'text-pink-400 bg-pink-400/10' },
    { labelKey: 'admin.stats.storage' as TranslationKey, value: stats.storageUsedFormatted, icon: HardDrive, color: 'text-violet-400 bg-violet-400/10' },
  ] : [];

  if (currentUser && currentUser.role !== 'ADMIN') {
    return <NotFoundPage />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-accent/10 text-accent">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">{t('admin.title')}</h1>
          <p className="text-sm text-text-secondary">{t('admin.subtitle')}</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-bg-secondary rounded-lg border border-border-primary mb-6 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              activeTab === tab.key
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
            )}
          >
            <tab.icon className="h-4 w-4" />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'dashboard' && (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {statsCards.map((card) => (
              <motion.div
                key={card.labelKey}
                variants={staggerItem}
                className="rounded-xl border border-border-primary bg-bg-secondary p-5 hover:border-border-secondary transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-text-secondary">{t(card.labelKey)}</span>
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', card.color)}>
                    <card.icon className="h-4.5 w-4.5" />
                  </div>
                </div>
                <p className="text-2xl font-display font-bold text-text-primary">{card.value}</p>
              </motion.div>
            ))}
          </motion.div>
        )
      )}

      {activeTab === 'utenti' && (
        loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Toolbar: sync + search + filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="default"
                size="sm"
                isLoading={syncing}
                onClick={handleSyncExternal}
                className="!text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {t('admin.syncExternal')}
              </Button>
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder={t('admin.searchUsers')}
                className="h-8 px-3 rounded-md bg-bg-primary border border-border-primary text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent w-64"
              />
              <div className="flex items-center gap-1 ml-auto">
                {(['all', 'active', 'inactive'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setUserFilter(f)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                      userFilter === f ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                    )}
                  >
                    {f === 'all' ? t('admin.filterAll') : f === 'active' ? t('admin.filterActive') : t('admin.filterInactive')}
                    <span className="ml-1 text-text-muted">
                      {f === 'all' ? users.length : f === 'active' ? users.filter(u => u.active).length : users.filter(u => !u.active).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Users table */}
            <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
              <div className="grid grid-cols-[60px_1fr_140px_130px_130px_100px_80px] gap-3 px-5 py-3 border-b border-border-primary bg-bg-tertiary/50 text-xs font-medium text-text-muted uppercase tracking-wider">
                <span>{t('admin.table.status')}</span>
                <span>{t('admin.table.email')}</span>
                <span>{t('admin.table.name')}</span>
                <span>{t('admin.table.department')}</span>
                <span>{t('admin.table.role')}</span>
                <span>{t('admin.table.createdAt')}</span>
                <span>{t('admin.table.actions')}</span>
              </div>

              <div className="divide-y divide-border-primary">
                {users
                  .filter(u => {
                    if (userFilter === 'active') return u.active;
                    if (userFilter === 'inactive') return !u.active;
                    return true;
                  })
                  .filter(u => {
                    if (!userSearch.trim()) return true;
                    const q = userSearch.toLowerCase();
                    return u.email.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q) || (u.department || '').toLowerCase().includes(q);
                  })
                  .map((u) => (
                  <div
                    key={u.id}
                    className={cn(
                      'grid grid-cols-[60px_1fr_140px_130px_130px_100px_80px] gap-3 px-5 py-3 items-center transition-colors hover:bg-bg-hover',
                      u.id === currentUser?.id && 'bg-accent/5',
                      !u.active && 'opacity-60',
                    )}
                  >
                    {/* Active toggle */}
                    <div>
                      <button
                        onClick={() => handleToggleActive(u.id, !u.active)}
                        disabled={u.id === currentUser?.id}
                        className="transition-colors"
                        title={u.active ? t('admin.deactivateUser') : t('admin.activateUser')}
                      >
                        {u.active ? (
                          <ToggleRight className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-text-muted" />
                        )}
                      </button>
                    </div>

                    {/* Email + avatar */}
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        name={u.name}
                        email={u.email}
                        avatar={u.avatar}
                        size="md"
                        className={!u.active ? 'opacity-50' : ''}
                      />
                      <span className="text-sm text-text-primary truncate">{u.email}</span>
                      {u.id === currentUser?.id && (
                        <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">{t('common.you')}</span>
                      )}
                    </div>

                    {/* Name */}
                    <span className="text-sm text-text-secondary truncate">{u.name || '—'}</span>

                    {/* Department */}
                    <span className="text-xs text-text-muted truncate flex items-center gap-1">
                      {u.department ? (
                        <><Building className="h-3 w-3 shrink-0" /> {u.department}</>
                      ) : '—'}
                    </span>

                    {/* Role */}
                    <div>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            className={cn(
                              'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors',
                              ROLE_COLORS[u.role],
                            )}
                            disabled={u.id === currentUser?.id}
                          >
                            <Shield className="h-3 w-3" />
                            {t(ROLE_LABEL_KEYS[u.role])}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            className="min-w-[160px] rounded-lg border border-border-primary bg-bg-secondary p-1 shadow-xl z-50"
                            sideOffset={4}
                          >
                            {(['ADMIN', 'EDITOR', 'VIEWER'] as Role[]).map((role) => (
                              <DropdownMenu.Item
                                key={role}
                                onSelect={() => handleRoleChange(u.id, role)}
                                className={cn(
                                  'flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none transition-colors',
                                  'hover:bg-bg-hover focus:bg-bg-hover',
                                  u.role === role ? 'text-accent' : 'text-text-secondary',
                                )}
                              >
                                {u.role === role && <Check className="h-3.5 w-3.5" />}
                                <span className={u.role === role ? '' : 'ml-5.5'}>{t(ROLE_LABEL_KEYS[role])}</span>
                              </DropdownMenu.Item>
                            ))}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>

                    {/* Created at */}
                    <span className="text-xs text-text-muted">{formatDate(u.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}</span>

                    {/* Actions */}
                    <div>
                      {deleteConfirm === u.id ? (
                        <div className="flex items-center gap-1">
                          <Button variant="danger" size="sm" className="!h-7 !px-2 !text-xs" onClick={() => handleDeleteUser(u.id)}>{t('common.confirm')}</Button>
                          <Button variant="ghost" size="sm" className="!h-7 !px-2 !text-xs" onClick={() => setDeleteConfirm(null)}>{t('common.no')}</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" className="text-text-muted hover:text-red-400" disabled={u.id === currentUser?.id} onClick={() => setDeleteConfirm(u.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {users.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-text-muted">{t('admin.noUsers')}</div>
              )}
            </div>
          </motion.div>
        )
      )}

      {activeTab === 'spazi' && (
        loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden"
          >
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_100px_120px_100px] gap-4 px-5 py-3 border-b border-border-primary bg-bg-tertiary/50 text-xs font-medium text-text-muted uppercase tracking-wider">
              <span>{t('admin.table.name')}</span>
              <span>{t('admin.table.creator')}</span>
              <span>{t('admin.table.pages')}</span>
              <span>{t('admin.table.access')}</span>
              <span>{t('admin.table.createdAt')}</span>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-border-primary">
              {spaces.map((space) => (
                <div
                  key={space.id}
                  className="grid grid-cols-[1fr_1fr_100px_120px_100px] gap-4 px-5 py-3 items-center hover:bg-bg-hover transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg">{space.icon || '\ud83d\udcc2'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{space.name}</p>
                      {space.description && (
                        <p className="text-xs text-text-muted truncate">{space.description}</p>
                      )}
                    </div>
                  </div>

                  <span className="text-sm text-text-secondary truncate">
                    {space.createdBy?.name || space.createdBy?.email || '—'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-text-muted" />
                    <span className="text-sm text-text-secondary">{space._count?.pages ?? 0}</span>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/wiki/api/spaces/${space.id}/restricted`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ isRestricted: !(space as any).isRestricted }),
                        });
                        if (res.ok) {
                          const updated = (await res.json()).data;
                          setSpaces(prev => prev.map(s => s.id === space.id ? { ...s, isRestricted: updated.isRestricted } : s) as AdminSpace[]);
                          addToast(updated.isRestricted ? t('admin.space.nowRestricted') : t('admin.space.nowOpen'), 'success');
                        }
                      } catch {}
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                      (space as any).isRestricted
                        ? 'bg-red-400/10 text-red-400 hover:bg-red-400/20'
                        : 'bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20',
                    )}
                  >
                    {(space as any).isRestricted ? (
                      <><Lock className="h-3 w-3" /> {t('admin.space.restricted')}</>
                    ) : (
                      <><Eye className="h-3 w-3" /> {t('admin.space.open')}</>
                    )}
                  </button>

                  <span className="text-xs text-text-muted">{formatDate(space.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              ))}
            </div>

            {spaces.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-text-muted">{t('admin.noSpaces')}</div>
            )}
          </motion.div>
        )
      )}

      {activeTab === 'audit' && (
        loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  placeholder={t('admin.audit.searchPlaceholder')}
                  value={auditSearch}
                  onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <select
                value={auditAction}
                onChange={(e) => { setAuditAction(e.target.value); setAuditPage(1); }}
                className="px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">{t('admin.audit.allActions')}</option>
                {Object.entries(ACTION_LABEL_KEYS).map(([key, labelKey]) => (
                  <option key={key} value={key}>{t(labelKey)}</option>
                ))}
              </select>
              <select
                value={auditResourceType}
                onChange={(e) => { setAuditResourceType(e.target.value); setAuditPage(1); }}
                className="px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">{t('admin.audit.allTypes')}</option>
                {Object.entries(RESOURCE_TYPE_LABEL_KEYS).map(([key, labelKey]) => (
                  <option key={key} value={key}>{t(labelKey)}</option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => exportAuditCSV({ search: auditSearch || undefined, action: auditAction || undefined, resourceType: auditResourceType || undefined })}
              >
                <Download className="h-4 w-4" />
                {t('admin.audit.exportCsv')}
              </Button>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
              <div className="grid grid-cols-[140px_1fr_120px_1fr_100px_40px] gap-3 px-4 py-2.5 border-b border-border-primary bg-bg-tertiary/50 text-xs font-medium text-text-muted uppercase tracking-wider">
                <span>{t('admin.audit.timestamp')}</span>
                <span>{t('admin.audit.user')}</span>
                <span>{t('admin.audit.action')}</span>
                <span>{t('admin.audit.resource')}</span>
                <span>{t('admin.audit.ip')}</span>
                <span></span>
              </div>

              <div className="divide-y divide-border-primary">
                {auditData?.logs.map((log) => (
                  <div key={log.id}>
                    <div
                      className="grid grid-cols-[140px_1fr_120px_1fr_100px_40px] gap-3 px-4 py-2.5 items-center hover:bg-bg-hover transition-colors cursor-pointer"
                      onClick={() => setExpandedAudit(expandedAudit === log.id ? null : log.id)}
                    >
                      <span className="text-xs text-text-muted font-mono">
                        {formatDate(log.timestamp, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="text-sm text-text-secondary truncate">{log.userEmail}</span>
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md w-fit', ACTION_COLORS[log.action] || 'text-text-muted bg-bg-tertiary')}>
                        {ACTION_LABEL_KEYS[log.action] ? t(ACTION_LABEL_KEYS[log.action]!) : log.action}
                      </span>
                      <span className="text-sm text-text-primary truncate">
                        {log.resourceTitle || log.resourceType}
                        {log.resourceId && <span className="text-text-muted text-xs ml-1">({log.resourceType})</span>}
                      </span>
                      <span className="text-xs text-text-muted font-mono truncate">{log.ipAddress || '—'}</span>
                      <Eye className="h-3.5 w-3.5 text-text-muted" />
                    </div>
                    {expandedAudit === log.id && (
                      <div className="px-4 py-3 bg-bg-tertiary/30 border-t border-border-primary">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                          <div><span className="text-text-muted">{t('admin.audit.resourceId')}:</span> <span className="text-text-secondary font-mono">{log.resourceId || '—'}</span></div>
                          <div><span className="text-text-muted">{t('admin.audit.space')}:</span> <span className="text-text-secondary font-mono">{log.spaceId || '—'}</span></div>
                          <div><span className="text-text-muted">{t('admin.audit.userAgent')}:</span> <span className="text-text-secondary truncate">{log.userAgent?.slice(0, 80) || '—'}</span></div>
                          <div><span className="text-text-muted">{t('admin.audit.userId')}:</span> <span className="text-text-secondary font-mono">{log.userId || '—'}</span></div>
                          {log.changes && (
                            <div className="col-span-2">
                              <span className="text-text-muted">{t('admin.audit.changes')}:</span>
                              <pre className="mt-1 text-text-secondary bg-bg-primary p-2 rounded-md overflow-x-auto">{JSON.stringify(log.changes, null, 2)}</pre>
                            </div>
                          )}
                          {log.metadata && (
                            <div className="col-span-2">
                              <span className="text-text-muted">{t('admin.audit.metadata')}:</span>
                              <pre className="mt-1 text-text-secondary bg-bg-primary p-2 rounded-md overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {(!auditData || auditData.logs.length === 0) && (
                <div className="px-5 py-12 text-center text-sm text-text-muted">{t('admin.audit.noEvents')}</div>
              )}
            </div>

            {/* Pagination */}
            {auditData && auditData.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-text-muted">
                  {t('admin.audit.total', { total: auditData.total, page: auditData.page, totalPages: auditData.totalPages })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={auditPage <= 1}
                    onClick={() => setAuditPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={auditPage >= auditData.totalPages}
                    onClick={() => setAuditPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )
      )}

      {activeTab === 'backup' && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Database backup */}
          <motion.div
            variants={staggerItem}
            className="rounded-xl border border-border-primary bg-bg-secondary p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-emerald-400/10 text-emerald-400 flex items-center justify-center">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-text-primary">{t('admin.backup.dbTitle')}</h3>
                <p className="text-xs text-text-muted">{t('admin.backup.dbDesc')}</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              {t('admin.backup.dbBody')}
            </p>
            <Button onClick={downloadDbBackup} className="w-full gap-2">
              <Download className="h-4 w-4" />
              {t('admin.backup.downloadDb')}
            </Button>
          </motion.div>

          {/* JSON export */}
          <motion.div
            variants={staggerItem}
            className="rounded-xl border border-border-primary bg-bg-secondary p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-sky-400/10 text-sky-400 flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-text-primary">{t('admin.backup.jsonTitle')}</h3>
                <p className="text-xs text-text-muted">{t('admin.backup.jsonDesc')}</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              {t('admin.backup.jsonBody')}
            </p>
            <Button onClick={downloadJsonBackup} variant="secondary" className="w-full gap-2">
              <Download className="h-4 w-4" />
              {t('admin.backup.downloadJson')}
            </Button>
          </motion.div>

          {/* Seed templates */}
          <motion.div
            variants={staggerItem}
            className="rounded-xl border border-border-primary bg-bg-secondary p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-violet-400/10 text-violet-400 flex items-center justify-center">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-text-primary">{t('admin.backup.templatesTitle')}</h3>
                <p className="text-xs text-text-muted">{t('admin.backup.templatesDesc')}</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              {t('admin.backup.templatesBody')}
            </p>
            <Button onClick={handleSeedTemplates} variant="secondary" disabled={seeding} className="w-full gap-2">
              <Package className="h-4 w-4" />
              {seeding ? t('admin.backup.seeding') : t('admin.backup.seedTemplates')}
            </Button>
          </motion.div>

          {/* Restore */}
          <motion.div
            variants={staggerItem}
            className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 md:col-span-2"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-red-400/10 text-red-400 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-text-primary">{t('admin.backup.restoreTitle')}</h3>
                <p className="text-xs text-text-muted">{t('admin.backup.restoreDesc')}</p>
              </div>
            </div>
            <p className="text-sm text-red-400 font-medium mb-4">
              {t('admin.backup.restoreWarning')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('admin.backup.backupType')}</label>
                <div className="flex gap-2">
                  <Button
                    variant={restoreType === 'db' ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => { setRestoreType('db'); setRestoreFile(null); setRestoreConfirm(''); }}
                  >
                    Database (.sql)
                  </Button>
                  <Button
                    variant={restoreType === 'json' ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => { setRestoreType('json'); setRestoreFile(null); setRestoreConfirm(''); }}
                  >
                    JSON (.json)
                  </Button>
                </div>
              </div>
              {restoreType && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('admin.backup.file', { type: restoreType === 'db' ? '.sql' : '.json' })}
                  </label>
                  <input
                    type="file"
                    accept={restoreType === 'db' ? '.sql' : '.json'}
                    onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                    className="text-sm text-text-secondary file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-bg-tertiary file:text-text-primary hover:file:bg-bg-hover"
                  />
                </div>
              )}
            </div>
            {restoreFile && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    {t('admin.backup.typeConfirm', { keyword: 'RIPRISTINA' })}
                  </label>
                  <input
                    type="text"
                    value={restoreConfirm}
                    onChange={(e) => setRestoreConfirm(e.target.value)}
                    placeholder="RIPRISTINA"
                    className="w-full max-w-xs px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-500"
                  />
                </div>
                <Button
                  variant="danger"
                  disabled={restoreConfirm !== 'RIPRISTINA' || restoring}
                  onClick={handleRestore}
                  className="gap-2"
                >
                  <Database className="h-4 w-4" />
                  {restoring ? t('admin.backup.restoring') : t('admin.backup.restoreBtn')}
                </Button>
              </div>
            )}
          </motion.div>

          {/* Warning */}
          <motion.div
            variants={staggerItem}
            className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-text-primary">{t('admin.backup.warningTitle')}</h3>
                <p className="text-xs text-text-muted">{t('admin.backup.warningDesc')}</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary">
              {t('admin.backup.warningBody')}
            </p>
          </motion.div>
        </motion.div>
      )}

      {activeTab === 'llm' && <LlmUsageTab />}

      {activeTab === 'import' && <ImportTab />}
    </div>
  );
}

// ── LLM Usage Tab Component ──────────────────────────────────────

function LlmUsageTab() {
  const t = useT();
  const [stats, setStats] = useState<LlmUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    getLlmUsage(days).then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  if (!stats) return <p className="text-text-muted text-sm">{t('common.error')}</p>;

  const maxDayCost = Math.max(0.001, ...stats.byDay.map(d => d.cost));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {[7, 30, 90].map(d => (
          <Button
            key={d}
            variant={days === d ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDays(d)}
          >
            {d}g
          </Button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-emerald-400/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
            <span className="text-xs text-text-muted uppercase tracking-wider">{t('admin.llm.totalCost')}</span>
          </div>
          <p className="text-2xl font-display font-bold text-emerald-400">${stats.totalCost.toFixed(4)}</p>
        </div>

        <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-violet-400/10 text-violet-400 flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-xs text-text-muted uppercase tracking-wider">{t('admin.llm.totalCalls')}</span>
          </div>
          <p className="text-2xl font-display font-bold text-text-primary">{stats.totalCalls.toLocaleString()}</p>
        </div>

        <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-sky-400/10 text-sky-400 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="text-xs text-text-muted uppercase tracking-wider">{t('admin.llm.totalTokens')}</span>
          </div>
          <p className="text-2xl font-display font-bold text-text-primary">{(stats.totalTokens / 1000).toFixed(1)}k</p>
        </div>

        <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
            <span className="text-xs text-text-muted uppercase tracking-wider">{t('admin.llm.avgPerCall')}</span>
          </div>
          <p className="text-2xl font-display font-bold text-text-primary">
            ${stats.totalCalls > 0 ? (stats.totalCost / stats.totalCalls).toFixed(5) : '0'}
          </p>
        </div>
      </div>

      {/* Daily cost chart (bar chart with CSS) */}
      {stats.byDay.length > 0 && (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-6">
          <h3 className="font-display font-semibold text-text-primary mb-4">{t('admin.llm.dailyCost')}</h3>
          <div className="flex items-end gap-1 h-32">
            {stats.byDay.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full bg-accent/80 rounded-t-sm hover:bg-accent transition-colors min-h-[2px]"
                  style={{ height: `${(d.cost / maxDayCost) * 100}%` }}
                />
                <div className="hidden group-hover:block absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-bg-tertiary border border-border-primary text-[10px] text-text-primary whitespace-nowrap z-10">
                  {d.date.slice(5)}: ${d.cost.toFixed(4)} ({d.calls} calls)
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-text-muted">
            <span>{stats.byDay[0]?.date.slice(5)}</span>
            <span>{stats.byDay[stats.byDay.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By service */}
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-6">
          <h3 className="font-display font-semibold text-text-primary mb-4">{t('admin.llm.byService')}</h3>
          <div className="space-y-3">
            {stats.byService.map(s => (
              <div key={s.service} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <span className="text-sm text-text-secondary">{s.service}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-text-muted">{s.calls} calls</span>
                  <span className="text-text-muted">{(s.tokens / 1000).toFixed(1)}k tok</span>
                  <span className="font-medium text-emerald-400">${s.cost.toFixed(4)}</span>
                </div>
              </div>
            ))}
            {stats.byService.length === 0 && (
              <p className="text-sm text-text-muted">{t('admin.llm.noData')}</p>
            )}
          </div>
        </div>

        {/* By model */}
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-6">
          <h3 className="font-display font-semibold text-text-primary mb-4">{t('admin.llm.byModel')}</h3>
          <div className="space-y-3">
            {stats.byModel.map(m => (
              <div key={m.model} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-violet-400" />
                  <span className="text-sm font-mono text-text-secondary">{m.model}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-text-muted">{m.calls} calls</span>
                  <span className="font-medium text-emerald-400">${m.cost.toFixed(4)}</span>
                </div>
              </div>
            ))}
            {stats.byModel.length === 0 && (
              <p className="text-sm text-text-muted">{t('admin.llm.noData')}</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Import Tab Component ──────────────────────────────────────────

const IMPORT_SOURCES = [
  { key: 'confluence', label: 'Confluence', desc: 'ZIP export da Confluence Cloud/Server', accept: '.zip', color: 'bg-blue-400/10 text-blue-400' },
  { key: 'notion', label: 'Notion', desc: 'ZIP export (Markdown & CSV)', accept: '.zip', color: 'bg-slate-400/10 text-slate-300' },
  { key: 'google-docs', label: 'Google Docs', desc: 'File HTML esportato da Google Docs', accept: '.html,.htm', color: 'bg-sky-400/10 text-sky-400' },
  { key: 'docx', label: 'Word DOCX', desc: 'Documento Microsoft Word', accept: '.docx,.doc', color: 'bg-indigo-400/10 text-indigo-400' },
  { key: 'markdown', label: 'Markdown', desc: 'File .md singolo', accept: '.md', color: 'bg-emerald-400/10 text-emerald-400' },
] as const;

function ImportTab() {
  const t = useT();
  const { addToast } = useToastStore();
  const [spaces, setSpaces] = useState<{ slug: string; name: string }[]>([]);
  const [selectedSpace, setSelectedSpace] = useState('');
  const [newSpaceName, setNewSpaceName] = useState('');
  const [createNewSpace, setCreateNewSpace] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ source: string; imported: number; failed: number; errors?: string[] } | null>(null);

  const loadSpaces = () => {
    getSpaces().then((s: any[]) => {
      setSpaces(s.map(sp => ({ slug: sp.slug, name: sp.name })));
      if (s.length > 0 && !selectedSpace) setSelectedSpace(s[0].slug);
    }).catch(() => {});
  };

  useEffect(() => { loadSpaces(); }, []);

  const resolveTargetSpace = async (): Promise<string | null> => {
    if (!createNewSpace) {
      if (!selectedSpace) { addToast(t('admin.import.selectSpace'), 'warning'); return null; }
      return selectedSpace;
    }
    if (!newSpaceName.trim()) { addToast(t('admin.import.enterSpaceName'), 'warning'); return null; }
    try {
      const res = await fetch('/wiki/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSpaceName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const created = (await res.json()).data;
      addToast(t('admin.import.spaceCreated', { name: created.name }), 'success');
      setCreateNewSpace(false);
      setSelectedSpace(created.slug);
      loadSpaces();
      return created.slug;
    } catch (err: any) {
      addToast(err.message || t('common.error'), 'error');
      return null;
    }
  };

  const handleImport = async (source: string, accept: string) => {
    const spaceSlug = await resolveTargetSpace();
    if (!spaceSlug) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setImporting(source);
      setLastResult(null);

      try {
        const endpoint = source === 'confluence'
          ? `/spaces/${spaceSlug}/import/confluence`
          : source === 'markdown'
            ? `/spaces/${spaceSlug}/import/markdown`
            : `/spaces/${spaceSlug}/import/${source}`;

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`/wiki/api${endpoint}`, {
          method: 'POST',
          body: formData,
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

        const data = json.data;
        setLastResult({
          source,
          imported: data.imported ?? 1,
          failed: data.failed ?? 0,
          errors: data.errors,
        });
        addToast(t('admin.import.success', { count: String(data.imported ?? 1) }), 'success');
      } catch (err: any) {
        addToast(err.message || t('common.error'), 'error');
      } finally {
        setImporting(null);
      }
    };
    input.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Space selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-sm font-medium text-text-secondary">{t('admin.import.targetSpace')}:</label>
        {createNewSpace ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newSpaceName}
              onChange={e => setNewSpaceName(e.target.value)}
              placeholder={t('admin.import.newSpaceName')}
              className="h-9 px-3 text-sm rounded-lg bg-bg-tertiary border border-border-primary text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
              autoFocus
            />
            <Button variant="ghost" size="sm" onClick={() => setCreateNewSpace(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedSpace}
              onChange={e => setSelectedSpace(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg bg-bg-tertiary border border-border-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {spaces.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
            <Button variant="ghost" size="sm" onClick={() => setCreateNewSpace(true)}>
              + {t('admin.import.newSpace')}
            </Button>
          </div>
        )}
      </div>

      {/* Import sources grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {IMPORT_SOURCES.map(src => (
          <div key={src.key} className="rounded-xl border border-border-primary bg-bg-secondary p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className={`h-10 w-10 rounded-lg ${src.color} flex items-center justify-center`}>
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-text-primary">{src.label}</h3>
                <p className="text-[11px] text-text-muted">{src.desc}</p>
              </div>
            </div>
            <div className="mt-auto pt-3">
              <Button
                onClick={() => handleImport(src.key, src.accept)}
                disabled={importing !== null}
                className="w-full gap-2"
                variant={importing === src.key ? 'default' : 'secondary'}
              >
                {importing === src.key ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {t('admin.import.importing')}</>
                ) : (
                  <><Upload className="h-4 w-4" /> {t('admin.import.upload')}</>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Last result */}
      {lastResult && (
        <div className={`rounded-xl border p-5 ${lastResult.failed > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
          <h3 className="font-display font-semibold text-text-primary mb-2">
            {t('admin.import.result', { source: lastResult.source })}
          </h3>
          <p className="text-sm text-text-secondary">
            {t('admin.import.resultDetail', { imported: String(lastResult.imported), failed: String(lastResult.failed) })}
          </p>
          {lastResult.errors && lastResult.errors.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto">
              {lastResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-amber-400">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
