import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { getSpaceGraph, type GraphNode, type GraphEdge, type GraphTag } from '@/api/graph';
import {
  Loader2, Maximize2, Minimize2, ZoomIn, ZoomOut, Focus,
  Search, Filter, CircleDot, AlertTriangle, Star, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useT } from '@/i18n';

interface Props {
  spaceSlug: string;
}

interface ForceNode {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  tags: GraphTag[];
  x?: number;
  y?: number;
  linkCount: number;
  inCount: number;
  outCount: number;
  isOrphan: boolean;
  isHub: boolean;
  clusterId: number;
}

interface ForceLink {
  source: string | ForceNode;
  target: string | ForceNode;
  type: 'link' | 'child';
}

type NodeFilter = 'all' | 'orphan' | 'hub';

// Cluster colors — visually distinct palette
const CLUSTER_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#14b8a6',
];

const HUB_THRESHOLD = 5;

// Simple connected-components clustering via BFS on link edges only
function computeClusters(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());

  for (const e of edges) {
    if (e.type !== 'link') continue;
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  const visited = new Set<string>();
  const clusterMap = new Map<string, number>();
  let clusterId = 0;

  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const queue = [n.id];
    visited.add(n.id);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      clusterMap.set(curr, clusterId);
      for (const neighbor of adj.get(curr) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    clusterId++;
  }

  return clusterMap;
}

export function GraphView({ spaceSlug }: Props) {
  const t = useT();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeFilter, setNodeFilter] = useState<NodeFilter>('all');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(null);
    getSpaceGraph(spaceSlug)
      .then(data => {
        setNodes(data.nodes);
        setEdges(data.edges);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [spaceSlug]);

  // All unique tags
  const allTags = useMemo(() => {
    const tagMap = new Map<string, GraphTag>();
    nodes.forEach(n => n.tags?.forEach(tag => tagMap.set(tag.id, tag)));
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [nodes]);

  // Compute link counts
  const { inCountMap, outCountMap, linkCountMap } = useMemo(() => {
    const inMap: Record<string, number> = {};
    const outMap: Record<string, number> = {};
    const totalMap: Record<string, number> = {};
    edges.forEach(e => {
      if (e.type === 'link') {
        outMap[e.source] = (outMap[e.source] || 0) + 1;
        inMap[e.target] = (inMap[e.target] || 0) + 1;
        totalMap[e.source] = (totalMap[e.source] || 0) + 1;
        totalMap[e.target] = (totalMap[e.target] || 0) + 1;
      }
    });
    return { inCountMap: inMap, outCountMap: outMap, linkCountMap: totalMap };
  }, [edges]);

  // Cluster assignment
  const clusterMap = useMemo(() => computeClusters(nodes, edges), [nodes, edges]);

  // Build force graph data with filtering
  const graphData = useMemo(() => {
    const forceNodes: ForceNode[] = nodes.map(n => {
      const linkCount = linkCountMap[n.id] || 0;
      const inCount = inCountMap[n.id] || 0;
      const outCount = outCountMap[n.id] || 0;
      return {
        ...n,
        tags: n.tags || [],
        linkCount,
        inCount,
        outCount,
        isOrphan: linkCount === 0,
        isHub: linkCount >= HUB_THRESHOLD,
        clusterId: clusterMap.get(n.id) ?? 0,
      };
    });

    // Apply filters
    let filtered = forceNodes;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(n => n.title.toLowerCase().includes(q));
    }

    // Node type filter
    if (nodeFilter === 'orphan') {
      filtered = filtered.filter(n => n.isOrphan);
    } else if (nodeFilter === 'hub') {
      filtered = filtered.filter(n => n.isHub);
    }

    // Tag filter
    if (selectedTags.size > 0) {
      filtered = filtered.filter(n =>
        n.tags.some(tag => selectedTags.has(tag.id))
      );
    }

    const filteredIds = new Set(filtered.map(n => n.id));

    const forceLinks: ForceLink[] = edges
      .filter(e => filteredIds.has(e.source) && filteredIds.has(e.target))
      .map(e => ({ source: e.source, target: e.target, type: e.type }));

    return { nodes: filtered, links: forceLinks };
  }, [nodes, edges, linkCountMap, inCountMap, outCountMap, clusterMap, searchQuery, nodeFilter, selectedTags]);

  // Connected nodes set for hover highlighting
  const connectedNodes = useMemo(() => {
    const active = hoveredNode || selectedNode;
    if (!active) return new Set<string>();
    const connected = new Set<string>([active]);
    edges.forEach(e => {
      if (e.source === active) connected.add(e.target);
      if (e.target === active) connected.add(e.source);
    });
    return connected;
  }, [hoveredNode, selectedNode, edges]);

  // Stats
  const stats = useMemo(() => {
    const orphans = nodes.filter(n => (linkCountMap[n.id] || 0) === 0).length;
    const hubs = nodes.filter(n => (linkCountMap[n.id] || 0) >= HUB_THRESHOLD).length;
    const linkEdges = edges.filter(e => e.type === 'link').length;
    return { total: nodes.length, links: linkEdges, orphans, hubs };
  }, [nodes, edges, linkCountMap]);

  // Double-click detection: first click selects, second click navigates
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const handleNodeClick = useCallback((node: ForceNode) => {
    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.id === node.id && now - last.time < 400) {
      // Double click — navigate
      navigate(`/${spaceSlug}/${node.slug}`);
      lastClickRef.current = null;
      return;
    }
    lastClickRef.current = { id: node.id, time: now };
    setSelectedNode(prev => prev === node.id ? null : node.id);
  }, [navigate, spaceSlug]);

  const handleNodeHover = useCallback((node: ForceNode | null) => {
    setHoveredNode(node?.id || null);
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'default';
    }
  }, []);

  const getNodeColor = useCallback((node: ForceNode): string => {
    return CLUSTER_COLORS[node.clusterId % CLUSTER_COLORS.length] || '#6366f1';
  }, []);

  const nodeCanvasObject = useCallback((node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const active = hoveredNode || selectedNode;
    const isHovered = hoveredNode === node.id;
    const isSelected = selectedNode === node.id;
    const isConnected = connectedNodes.has(node.id);
    const isDimmed = active !== null && !isConnected;
    const color = getNodeColor(node);

    // Node size based on link count
    const baseSize = node.isOrphan ? 4 : 4 + Math.min(node.linkCount * 1.5, 14);
    const size = (isHovered || isSelected) ? baseSize * 1.3 : baseSize;

    // Hub glow ring
    if (node.isHub) {
      ctx.beginPath();
      ctx.arc(x, y, size + 6, 0, 2 * Math.PI);
      ctx.strokeStyle = isDimmed ? 'rgba(255, 255, 255, 0.03)' : `${color}33`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Selected glow
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, size + 5, 0, 2 * Math.PI);
      ctx.fillStyle = `${color}30`;
      ctx.fill();
    }

    // Hovered glow
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
      ctx.fillStyle = `${color}25`;
      ctx.fill();
    }

    // Draw node circle
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    if (isDimmed) {
      ctx.fillStyle = node.isOrphan ? 'rgba(239, 68, 68, 0.1)' : `${color}18`;
    } else if (node.isOrphan) {
      // Orphan: orange-ish
      ctx.fillStyle = isHovered ? '#fb923c' : '#f97316';
    } else {
      ctx.fillStyle = (isHovered || isSelected) ? color : `${color}cc`;
    }
    ctx.fill();

    // Border
    if (node.isOrphan && !isDimmed) {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = isDimmed ? `${color}15` : `${color}60`;
      ctx.lineWidth = (isHovered || isSelected) ? 2 : 1;
      ctx.stroke();
    }

    // Hub star indicator
    if (node.isHub && !isDimmed) {
      ctx.font = `${Math.max(8 / globalScale, 4)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('\u2605', x, y);
    }

    // Draw label
    const fontSize = Math.max(11 / globalScale, 3);
    const showLabel = globalScale > 0.5 || isHovered || isSelected || isConnected;
    if (showLabel) {
      ctx.font = `${(isHovered || isSelected) ? 'bold ' : ''}${fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isDimmed ? 'rgba(160, 160, 176, 0.2)' : (isHovered || isSelected) ? '#e8e8ed' : '#a0a0b0';
      const maxLen = 25;
      const label = node.title.length > maxLen ? node.title.substring(0, maxLen) + '...' : node.title;
      ctx.fillText(label, x, y + size + 3);
    }
  }, [hoveredNode, selectedNode, connectedNodes, getNodeColor]);

  const linkCanvasObject = useCallback((link: ForceLink, ctx: CanvasRenderingContext2D) => {
    const source = link.source as ForceNode;
    const target = link.target as ForceNode;
    if (!source.x || !source.y || !target.x || !target.y) return;

    const active = hoveredNode || selectedNode;
    const sourceId = source.id;
    const targetId = target.id;
    const isHighlighted = active !== null && connectedNodes.has(sourceId) && connectedNodes.has(targetId);
    const isDimmed = active !== null && !isHighlighted;

    ctx.beginPath();

    if (link.type === 'child') {
      // Dashed line for parent-child
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = isDimmed ? 'rgba(160, 160, 176, 0.03)' : isHighlighted ? 'rgba(160, 160, 176, 0.4)' : 'rgba(160, 160, 176, 0.12)';
      ctx.lineWidth = isHighlighted ? 1.5 : 0.5;
    } else {
      // Solid line for page links
      ctx.setLineDash([]);
      const color = getNodeColor(source);
      ctx.strokeStyle = isDimmed ? `${color}08` : isHighlighted ? `${color}80` : `${color}20`;
      ctx.lineWidth = isHighlighted ? 2 : 0.8;
    }

    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow for link edges
    if (link.type === 'link' && !isDimmed) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;
      const arrowPos = 0.85;
      const ax = source.x + dx * arrowPos;
      const ay = source.y + dy * arrowPos;
      const angle = Math.atan2(dy, dx);
      const arrowLen = 4;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - arrowLen * Math.cos(angle - 0.4), ay - arrowLen * Math.sin(angle - 0.4));
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - arrowLen * Math.cos(angle + 0.4), ay - arrowLen * Math.sin(angle + 0.4));
      ctx.strokeStyle = isHighlighted ? 'rgba(99, 102, 241, 0.6)' : 'rgba(99, 102, 241, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [hoveredNode, selectedNode, connectedNodes, getNodeColor]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Center graph after data loads
  useEffect(() => {
    if (!loading && graphRef.current && nodes.length > 0) {
      setTimeout(() => graphRef.current?.zoomToFit(400, 60), 500);
    }
  }, [loading, nodes.length]);

  // Selected node details
  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    return graphData.nodes.find(n => n.id === selectedNode) || null;
  }, [selectedNode, graphData.nodes]);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        {t('graph.error', { error })}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
        <p className="text-lg">{t('graph.noPages')}</p>
        <p className="text-sm">{t('graph.noPagesDesc')}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-bg-primary rounded-lg overflow-hidden flex">
      {/* Sidebar */}
      <div
        className={`relative z-20 flex flex-col border-r border-border-primary bg-bg-secondary/95 backdrop-blur-sm transition-all duration-200 ${
          sidebarOpen ? 'w-72' : 'w-0'
        } overflow-hidden`}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-5 min-w-[288px]">
          {/* Search */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
              <Search className="h-3 w-3 inline mr-1" />
              {t('graph.search')}
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('graph.searchPlaceholder')}
              className="w-full h-8 px-3 rounded-md bg-bg-primary border border-border-primary text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Node type filter */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
              <Filter className="h-3 w-3 inline mr-1" />
              {t('graph.filterType')}
            </label>
            <div className="flex flex-col gap-1">
              {([
                { key: 'all' as NodeFilter, icon: CircleDot, label: t('graph.filterAll'), count: stats.total },
                { key: 'orphan' as NodeFilter, icon: AlertTriangle, label: t('graph.filterOrphan'), count: stats.orphans },
                { key: 'hub' as NodeFilter, icon: Star, label: t('graph.filterHub'), count: stats.hubs },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setNodeFilter(f.key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    nodeFilter === f.key
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  <f.icon className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left">{f.label}</span>
                  <span className="text-xs text-text-muted">{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
                {t('graph.filterTags')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border ${
                      selectedTags.has(tag.id)
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border-primary text-text-muted hover:text-text-primary hover:border-border-secondary'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color || '#6366f1' }}
                    />
                    {tag.name}
                  </button>
                ))}
              </div>
              {selectedTags.size > 0 && (
                <button
                  onClick={() => setSelectedTags(new Set())}
                  className="text-xs text-accent hover:underline mt-1.5"
                >
                  {t('graph.clearFilters')}
                </button>
              )}
            </div>
          )}

          {/* Legend */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
              {t('graph.legend')}
            </label>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#f97316] border border-dashed border-[#f97316]" />
                <span className="text-text-secondary">{t('graph.legendOrphan')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-[#6366f1] flex items-center justify-center text-[8px] text-yellow-400">{'\u2605'}</span>
                <span className="text-text-secondary">{t('graph.legendHub')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-px w-6 bg-text-muted" />
                <span className="text-text-secondary">{t('graph.legendLink')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-px w-6 border-t border-dashed border-text-muted" />
                <span className="text-text-secondary">{t('graph.legendChild')}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border-primary">
                <span className="text-text-muted italic">{t('graph.legendDblClick')}</span>
              </div>
            </div>
          </div>

          {/* Selected node info */}
          {selectedNodeData && (
            <div className="border-t border-border-primary pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t('graph.selectedPage')}
                </label>
                <button onClick={() => setSelectedNode(null)} className="text-text-muted hover:text-text-primary">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-text-primary truncate">{selectedNodeData.title}</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="text-text-muted">{t('graph.inLinks')}</div>
                  <div className="text-text-primary font-medium">{selectedNodeData.inCount}</div>
                  <div className="text-text-muted">{t('graph.outLinks')}</div>
                  <div className="text-text-primary font-medium">{selectedNodeData.outCount}</div>
                </div>
                {selectedNodeData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedNodeData.tags.map(tag => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border border-border-primary text-text-muted"
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color || '#6366f1' }} />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => navigate(`/${spaceSlug}/${selectedNodeData.slug}`)}
                  className="w-full mt-1 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
                >
                  {t('graph.goToPage')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar stats footer */}
        <div className="border-t border-border-primary px-4 py-3 text-xs text-text-muted space-y-0.5 min-w-[288px]">
          <div className="flex justify-between">
            <span>{t('graph.pages', { count: stats.total })}</span>
            <span>{t('graph.links', { count: stats.links })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-orange-400">{t('graph.orphanCount', { count: stats.orphans })}</span>
            <span className="text-yellow-400">{t('graph.hubCount', { count: stats.hubs })}</span>
          </div>
        </div>
      </div>

      {/* Sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(prev => !prev)}
        className="absolute top-4 left-4 z-30 p-1.5 rounded-lg bg-bg-secondary/80 backdrop-blur-sm border border-border-primary text-text-muted hover:text-text-primary transition-colors"
        style={{ left: sidebarOpen ? '17.5rem' : '1rem' }}
      >
        {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {/* Graph canvas area */}
      <div className="flex-1 relative">
        {/* Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1">
          <button
            onClick={() => graphRef.current?.zoomToFit(400, 60)}
            title={t('graph.center')}
            className="p-2 rounded-lg bg-bg-secondary/80 backdrop-blur-sm border border-border-primary text-text-muted hover:text-text-primary transition-colors"
          >
            <Focus className="h-4 w-4" />
          </button>
          <button
            onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 300)}
            title={t('graph.zoomIn')}
            className="p-2 rounded-lg bg-bg-secondary/80 backdrop-blur-sm border border-border-primary text-text-muted hover:text-text-primary transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 0.7, 300)}
            title={t('graph.zoomOut')}
            className="p-2 rounded-lg bg-bg-secondary/80 backdrop-blur-sm border border-border-primary text-text-muted hover:text-text-primary transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? t('graph.exitFullscreen') : t('graph.fullscreen')}
            className="p-2 rounded-lg bg-bg-secondary/80 backdrop-blur-sm border border-border-primary text-text-muted hover:text-text-primary transition-colors"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Hovered node info */}
        {hoveredNode && !selectedNode && (() => {
          const node = graphData.nodes.find(n => n.id === hoveredNode);
          if (!node) return null;
          return (
            <div className="absolute top-4 left-4 z-10 bg-bg-secondary/90 backdrop-blur-sm border border-border-primary rounded-lg px-4 py-3 max-w-xs">
              <div className="font-medium text-text-primary text-sm truncate">{node.title}</div>
              <div className="text-xs text-text-muted mt-1 flex gap-3">
                <span>{t('graph.inLinks')}: {node.inCount}</span>
                <span>{t('graph.outLinks')}: {node.outCount}</span>
              </div>
              {node.isOrphan && <div className="text-xs text-orange-400 mt-0.5">{t('graph.legendOrphan')}</div>}
              {node.isHub && <div className="text-xs text-yellow-400 mt-0.5">{t('graph.legendHub')}</div>}
            </div>
          );
        })()}

        {/* Showing filtered results */}
        {(searchQuery || nodeFilter !== 'all' || selectedTags.size > 0) && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-bg-secondary/90 backdrop-blur-sm border border-border-primary rounded-lg px-3 py-1.5 text-xs text-text-muted">
            {t('graph.showing', { count: graphData.nodes.length, total: nodes.length })}
          </div>
        )}

        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node: ForceNode, color, ctx) => {
            const size = 4 + Math.min((linkCountMap[node.id] || 0) * 1.5, 14);
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, size + 5, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkCanvasObject={linkCanvasObject}
          linkDirectionalArrowLength={0}
          onNodeClick={handleNodeClick}
          onNodeDragEnd={handleNodeClick}
          onNodeHover={handleNodeHover}
          onBackgroundClick={() => setSelectedNode(null)}
          backgroundColor="transparent"
          d3AlphaDecay={0.03}
          d3VelocityDecay={0.3}
          warmupTicks={50}
          cooldownTime={3000}
        />
      </div>
    </div>
  );
}
