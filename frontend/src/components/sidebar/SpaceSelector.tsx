import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Plus, Layout, Shield, Image, Trash2, Archive, Settings, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpaceStore } from '@/stores/spaceStore';
import { CreateSpaceModal } from './CreateSpaceModal';
import { SpaceSettingsModal } from './SpaceSettingsModal';
import { MediaManager } from './MediaManager';
import { TrashPanel } from './TrashPanel';
import { ArchivePanel } from './ArchivePanel';
import { useAuthStore } from '@/stores/authStore';
import { usePageStore } from '@/stores/pageStore';
import { useT } from '@/i18n';

export function SpaceSelector() {
  const navigate = useNavigate();
  const { spaceSlug } = useParams<{ spaceSlug: string }>();
  const { spaces, currentSpace } = useSpaceStore();
  const { user } = useAuthStore();
  const { fetchPageTree } = usePageStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const t = useT();

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors text-sm">
            <div className="flex items-center justify-center h-6 w-6 rounded bg-accent/20 text-accent text-xs">
              {currentSpace?.icon || <Layout className="h-3.5 w-3.5" />}
            </div>
            <span className="truncate flex-1 text-left text-text-primary font-medium">
              {currentSpace?.name || t('nav.selectSpace')}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-text-muted shrink-0" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="w-60 rounded-lg border border-border-primary bg-bg-secondary shadow-xl p-1 z-50"
            sideOffset={4}
            align="start"
          >
            {spaces.map((space) => (
              <DropdownMenu.Item
                key={space.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none transition-colors',
                  spaceSlug === space.slug
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
                onClick={() => navigate(`/${space.slug}`)}
              >
                <span className="text-base">{space.icon || '\ud83d\udcc2'}</span>
                <span className="truncate">{space.name}</span>
                <span className="ml-auto text-xs text-text-muted">{space._count.pages}</span>
              </DropdownMenu.Item>
            ))}

            <DropdownMenu.Separator className="h-px bg-border-primary my-1" />

            {currentSpace && (
              <>
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  onClick={() => setMediaOpen(true)}
                >
                  <Image className="h-4 w-4" />
                  {t('spaceSelector.mediaManager')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Shield className="h-4 w-4" />
                  {t('spaceSelector.permissions')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  onClick={() => setTrashOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('spaceSelector.trash')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  onClick={() => setArchiveOpen(true)}
                >
                  <Archive className="h-4 w-4" />
                  {t('spaceSelector.archive')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  onClick={() => window.open(`/wiki/api/spaces/${currentSpace.slug}/export`, '_blank')}
                >
                  <Download className="h-4 w-4" />
                  {t('spaceSelector.exportSpace')}
                </DropdownMenu.Item>
              </>
            )}

            {user?.role === 'ADMIN' && (
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                onClick={() => navigate('/admin')}
              >
                <Settings className="h-4 w-4" />
                {t('spaceSelector.admin')}
              </DropdownMenu.Item>
            )}

            {user?.role === 'ADMIN' && (
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                {t('spaceSelector.createSpace')}
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <CreateSpaceModal open={createOpen} onOpenChange={setCreateOpen} />
      {currentSpace && (
        <>
          <SpaceSettingsModal
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            spaceId={currentSpace.id}
            spaceName={currentSpace.name}
          />
          <MediaManager
            open={mediaOpen}
            onOpenChange={setMediaOpen}
            spaceSlug={currentSpace.slug}
          />
          <TrashPanel
            spaceSlug={currentSpace.slug}
            open={trashOpen}
            onClose={() => setTrashOpen(false)}
            onRestore={() => {
              if (spaceSlug) fetchPageTree(spaceSlug);
            }}
          />
          <ArchivePanel
            spaceSlug={currentSpace.slug}
            open={archiveOpen}
            onClose={() => setArchiveOpen(false)}
            onRestore={() => {
              if (spaceSlug) fetchPageTree(spaceSlug);
            }}
          />
        </>
      )}
    </>
  );
}
