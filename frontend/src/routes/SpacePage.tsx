import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, FileText, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { CreatePageModal } from '@/components/sidebar/CreatePageModal';
import { ConfluenceImportModal } from '@/components/import/ConfluenceImportModal';
import { useSpaceStore } from '@/stores/spaceStore';
import { usePageStore } from '@/stores/pageStore';
import { getSpace } from '@/api/spaces';
import { useT } from '@/i18n';

export function SpacePage() {
  const { spaceSlug } = useParams<{ spaceSlug: string }>();
  const navigate = useNavigate();
  const { setCurrentSpace } = useSpaceStore();
  const { pageTree, treeLoading, fetchPageTree } = usePageStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    if (!spaceSlug) return;
    setLoading(true);
    getSpace(spaceSlug)
      .then((space) => {
        setCurrentSpace(space);
        fetchPageTree(spaceSlug);
        setLoading(false);
      })
      .catch(() => {
        navigate('/');
        setLoading(false);
      });
  }, [spaceSlug, setCurrentSpace, fetchPageTree, navigate]);

  // Redirect to first page if one exists
  useEffect(() => {
    if (!treeLoading && pageTree.length > 0 && spaceSlug) {
      navigate(`/${spaceSlug}/${pageTree[0]!.slug}`, { replace: true });
    }
  }, [treeLoading, pageTree, spaceSlug, navigate]);

  const handlePageCreated = (slug: string) => {
    if (spaceSlug) navigate(`/${spaceSlug}/${slug}`);
  };

  if (loading || treeLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-96" />
      </div>
    );
  }

  if (pageTree.length === 0) {
    return (
      <>
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={t('space.noPages')}
          description={t('space.noPagesDesc')}
          action={
            <div className="flex items-center gap-2">
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('space.newPage')}
              </Button>
              <Button variant="secondary" className="gap-2" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                {t('space.importConfluence')}
              </Button>
              {spaceSlug && (
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => window.open(`/wiki/api/spaces/${spaceSlug}/export`, '_blank')}
                >
                  <Download className="h-4 w-4" />
                  {t('space.exportSpace')}
                </Button>
              )}
            </div>
          }
        />
        {spaceSlug && (
          <>
            <CreatePageModal
              open={createOpen}
              onOpenChange={setCreateOpen}
              spaceSlug={spaceSlug}
              onCreated={handlePageCreated}
            />
            <ConfluenceImportModal
              open={importOpen}
              onOpenChange={setImportOpen}
              spaceSlug={spaceSlug}
              onImported={() => fetchPageTree(spaceSlug)}
            />
          </>
        )}
      </>
    );
  }

  return null;
}
