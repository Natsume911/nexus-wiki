import { FileText, Hash, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchResult as SearchResultType } from '@/types';

interface SearchResultProps {
  result: SearchResultType;
  active: boolean;
  onClick: () => void;
  hideSpace?: boolean;
}

export function SearchResult({ result, active, onClick, hideSpace }: SearchResultProps) {
  const isAttachment = result.type === 'attachment';

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 w-full px-3 py-2.5 rounded-md text-left transition-colors',
        active ? 'bg-accent/15 text-text-primary' : 'hover:bg-bg-hover',
      )}
    >
      {isAttachment ? (
        <Paperclip className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
      ) : (
        <FileText className="h-4 w-4 mt-0.5 shrink-0 text-text-muted" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-text-primary truncate">{result.title}</span>
          {isAttachment && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400 uppercase">
              {result.attachmentMeta?.mimeType.split('/').pop()}
            </span>
          )}
        </div>
        {result.heading && (
          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-violet-400">
            <Hash className="h-3 w-3" />
            <span className="truncate">{result.heading}</span>
          </div>
        )}
        <div
          className="text-xs text-text-muted mt-0.5 line-clamp-2 [&>mark]:bg-accent/30 [&>mark]:text-text-primary [&>mark]:rounded-sm [&>mark]:px-0.5"
          dangerouslySetInnerHTML={{ __html: result.headline }}
        />
        {!hideSpace && (
          <div className="flex items-center gap-1 mt-1">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-tertiary text-text-muted">
              {result.space.name}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
