import { User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useT } from '@/i18n';

export function UserMenu() {
  const { user } = useAuthStore();
  const t = useT();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-accent/20 text-accent shrink-0">
        <User className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">
          {user?.name || user?.email || t('common.user')}
        </div>
        <div className="text-xs text-text-muted truncate">{user?.email}</div>
      </div>
      <ThemeToggle />
    </div>
  );
}
