import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useT } from '@/i18n';
import type { Collaborator } from '@/hooks/useCollaboration';

interface CollaborationStatusProps {
  connected: boolean;
  synced: boolean;
  collaborators: Collaborator[];
  hasUnsyncedChanges?: boolean;
}

export function CollaborationStatus({ connected, synced, collaborators, hasUnsyncedChanges }: CollaborationStatusProps) {
  const t = useT();
  const [disconnectedTime, setDisconnectedTime] = useState<number | null>(null);

  // Track how long we've been disconnected
  useEffect(() => {
    if (!connected) {
      setDisconnectedTime(Date.now());
    } else {
      setDisconnectedTime(null);
    }
  }, [connected]);

  const disconnectedSecs = disconnectedTime ? Math.floor((Date.now() - disconnectedTime) / 1000) : 0;
  const showError = !connected && disconnectedSecs > 10;

  const dotColor = showError
    ? 'bg-red-400 animate-pulse'
    : hasUnsyncedChanges
      ? 'bg-amber-400 animate-pulse'
      : connected
        ? synced
          ? 'bg-emerald-400'
          : 'bg-amber-400 animate-pulse'
        : 'bg-red-400';

  const statusText = showError
    ? t('collab.connectionLost')
    : hasUnsyncedChanges
      ? t('collab.unsynced')
      : connected
        ? synced
          ? t('collab.connected')
          : t('collab.syncing')
        : t('collab.disconnected');

  const typingCollabs = collaborators.filter(c => c.typing);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5" title={statusText}>
        <div className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className={`text-xs ${showError ? 'text-red-400 font-medium' : 'text-text-muted'}`}>{statusText}</span>
      </div>

      {showError && (
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
          title={t('collab.retry')}
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}

      {collaborators.length > 0 && (
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1.5">
            {collaborators.slice(0, 4).map((c) => (
              <div
                key={c.id}
                title={t('collab.editing', { name: c.name || c.email })}
                className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white ring-2 ring-bg-primary"
                style={{ backgroundColor: c.color }}
              >
                {(c.name || c.email || '?').charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          {collaborators.length > 4 && (
            <span className="text-xs text-text-muted">+{collaborators.length - 4}</span>
          )}
        </div>
      )}

      {typingCollabs.length > 0 && (
        <span className="text-xs text-text-muted italic animate-pulse">
          {typingCollabs.length === 1
            ? t('collab.typing', { name: typingCollabs[0]?.name || typingCollabs[0]?.email || '' })
            : t('collab.typingMultiple', { count: typingCollabs.length })}
        </span>
      )}
    </div>
  );
}
