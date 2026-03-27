import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { GraphView } from '@/components/graph/GraphView';
import { useSpaceStore } from '@/stores/spaceStore';

export function GraphPage() {
  const { spaceSlug } = useParams<{ spaceSlug: string }>();
  const { spaces, fetchSpaces, setCurrentSpace } = useSpaceStore();

  useEffect(() => {
    if (spaces.length === 0) fetchSpaces();
  }, [spaces.length, fetchSpaces]);

  useEffect(() => {
    if (spaceSlug && spaces.length > 0) {
      const space = spaces.find(s => s.slug === spaceSlug);
      if (space) setCurrentSpace(space);
    }
  }, [spaceSlug, spaces, setCurrentSpace]);

  if (!spaceSlug) return null;

  return (
    <div className="h-[calc(100vh-3rem)]">
      <GraphView spaceSlug={spaceSlug} />
    </div>
  );
}
