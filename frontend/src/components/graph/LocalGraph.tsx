import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { getLocalGraph, type GraphNode, type GraphEdge } from '@/api/graph';
import { ChevronDown, ChevronRight, Network, Maximize2 } from 'lucide-react';
import { useT } from '@/i18n';

interface Props {
  pageId: string;
}

interface LocalForceNode {
  id: string;
  title: string;
  slug: string;
  isCenter: boolean;
  x?: number;
  y?: number;
}

interface LocalForceLink {
  source: string | LocalForceNode;
  target: string | LocalForceNode;
  type: 'link' | 'child';
}

export function LocalGraph({ pageId }: Props) {
  const t = useT();
  const { spaceSlug } = useParams<{ spaceSlug: string }>();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [centerId, setCenterId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getLocalGraph(pageId)
      .then(data => {
        setNodes(data.nodes);
        setEdges(data.edges);
        setCenterId(data.centerId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pageId]);

  const graphData = useMemo(() => {
    const forceNodes: LocalForceNode[] = nodes.map(n => ({
      id: n.id,
      title: n.title,
      slug: n.slug,
      isCenter: n.id === centerId,
    }));
    const forceLinks: LocalForceLink[] = edges.map(e => ({
      source: e.source,
      target: e.target,
      type: e.type,
    }));
    return { nodes: forceNodes, links: forceLinks };
  }, [nodes, edges, centerId]);

  // Connected to hovered
  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const set = new Set<string>([hoveredNode]);
    edges.forEach(e => {
      if (e.source === hoveredNode) set.add(e.target);
      if (e.target === hoveredNode) set.add(e.source);
    });
    return set;
  }, [hoveredNode, edges]);

  const handleNodeClick = useCallback((node: LocalForceNode) => {
    if (node.isCenter) return;
    if (spaceSlug) navigate(`/${spaceSlug}/${node.slug}`);
  }, [navigate, spaceSlug]);

  const nodeCanvasObject = useCallback((node: LocalForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const isHovered = hoveredNode === node.id;
    const isConnected = connectedNodes.has(node.id);
    const isDimmed = hoveredNode !== null && !isConnected;
    const size = node.isCenter ? 8 : 5;

    // Center node glow
    if (node.isCenter) {
      ctx.beginPath();
      ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      ctx.fill();
    }

    if (isHovered && !node.isCenter) {
      ctx.beginPath();
      ctx.arc(x, y, size + 3, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    if (node.isCenter) {
      ctx.fillStyle = '#6366f1';
    } else if (isDimmed) {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
    } else if (isHovered) {
      ctx.fillStyle = '#818cf8';
    } else {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.6)';
    }
    ctx.fill();
    ctx.strokeStyle = isDimmed ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    const fontSize = Math.max(10 / globalScale, 3);
    if (globalScale > 0.3 || isHovered || node.isCenter) {
      ctx.font = `${(isHovered || node.isCenter) ? 'bold ' : ''}${fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isDimmed ? 'rgba(160, 160, 176, 0.3)' : (isHovered || node.isCenter) ? '#e8e8ed' : '#a0a0b0';
      const maxLen = 18;
      const label = node.title.length > maxLen ? node.title.substring(0, maxLen) + '...' : node.title;
      ctx.fillText(label, x, y + size + 2);
    }
  }, [hoveredNode, connectedNodes]);

  const linkCanvasObject = useCallback((link: LocalForceLink, ctx: CanvasRenderingContext2D) => {
    const source = link.source as LocalForceNode;
    const target = link.target as LocalForceNode;
    if (!source.x || !source.y || !target.x || !target.y) return;

    ctx.beginPath();
    if (link.type === 'child') {
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = 'rgba(160, 160, 176, 0.15)';
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
    }
    ctx.lineWidth = 0.8;
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  // Auto-fit on data load
  useEffect(() => {
    if (!loading && expanded && graphRef.current && nodes.length > 0) {
      setTimeout(() => graphRef.current?.zoomToFit(300, 30), 300);
    }
  }, [loading, expanded, nodes.length]);

  // Not enough connections to show
  if (!loading && nodes.length <= 1) return null;

  return (
    <div className="mt-6 border border-border-primary rounded-xl bg-bg-secondary/50 overflow-hidden">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Network className="h-4 w-4 text-accent" />
        <span>{t('graph.localTitle')}</span>
        <span className="text-xs text-text-muted ml-auto">
          {nodes.length - 1} {t('graph.connections')}
        </span>
      </button>

      {expanded && (
        <div ref={containerRef} className="relative border-t border-border-primary" style={{ height: 280 }}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              {t('common.loading')}
            </div>
          ) : (
            <>
              <button
                onClick={() => spaceSlug && navigate(`/${spaceSlug}/graph`)}
                title={t('graph.openFull')}
                className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-bg-secondary/80 backdrop-blur-sm border border-border-primary text-text-muted hover:text-text-primary transition-colors"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeCanvasObject={nodeCanvasObject}
                nodePointerAreaPaint={(node: LocalForceNode, color, ctx) => {
                  ctx.beginPath();
                  ctx.arc(node.x ?? 0, node.y ?? 0, 12, 0, 2 * Math.PI);
                  ctx.fillStyle = color;
                  ctx.fill();
                }}
                linkCanvasObject={linkCanvasObject}
                linkDirectionalArrowLength={0}
                onNodeClick={handleNodeClick}
                onNodeHover={(node: LocalForceNode | null) => {
                  setHoveredNode(node?.id || null);
                  if (containerRef.current) {
                    containerRef.current.style.cursor = (node && !node.isCenter) ? 'pointer' : 'default';
                  }
                }}
                backgroundColor="transparent"
                d3AlphaDecay={0.05}
                d3VelocityDecay={0.4}
                warmupTicks={30}
                cooldownTime={2000}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
