import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, type Toast } from '@/stores/toastStore';
import { cn } from '@/lib/utils';

const icons: Record<Toast['type'], typeof Info> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors: Record<Toast['type'], string> = {
  success: 'border-success/50 bg-success/10',
  error: 'border-error/50 bg-error/10',
  info: 'border-info/50 bg-info/10',
  warning: 'border-warning/50 bg-warning/10',
};

const iconColors: Record<Toast['type'], string> = {
  success: 'text-success',
  error: 'text-error',
  info: 'text-info',
  warning: 'text-warning',
};

export function ToastProvider() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={cn(
                'flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg',
                colors[toast.type],
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', iconColors[toast.type])} />
              <span className="text-sm text-text-primary flex-1">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
