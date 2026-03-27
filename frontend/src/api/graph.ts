import { get } from './client';

export interface GraphTag {
  id: string;
  name: string;
  color: string;
}

export interface GraphNode {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  tags?: GraphTag[];
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'link' | 'child';
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  spaceSlug: string;
}

export interface LocalGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerId: string;
}

export async function getSpaceGraph(spaceSlug: string): Promise<GraphData> {
  return get(`/spaces/${spaceSlug}/graph`);
}

export async function getLocalGraph(pageId: string): Promise<LocalGraphData> {
  return get(`/pages/${pageId}/local-graph`);
}
