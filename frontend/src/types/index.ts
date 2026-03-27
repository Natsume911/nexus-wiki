export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: Role;
  active: boolean;
  department: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Space {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  createdById: string;
  createdBy: Pick<User, 'id' | 'name' | 'email'>;
  _count: { pages: number };
  createdAt: string;
  updatedAt: string;
}

export interface PageTreeNode {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  children: PageTreeNode[];
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: Record<string, unknown>;
  spaceId: string;
  parentId: string | null;
  authorId: string;
  order: number;
  author: Pick<User, 'id' | 'name' | 'email'>;
  space?: Pick<Space, 'id' | 'name' | 'slug'>;
  children?: { id: string; title: string; slug: string; order: number }[];
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Breadcrumb {
  id: string;
  title: string;
  slug: string;
}

export interface PageVersion {
  id: string;
  title: string;
  content?: Record<string, unknown>;
  editedBy: Pick<User, 'id' | 'name' | 'email'>;
  createdAt: string;
}

export interface Comment {
  id: string;
  pageId: string;
  parentId?: string | null;
  content: string;
  author: Pick<User, 'id' | 'name' | 'email'> & { avatar?: string | null };
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  pageId: string | null;
  spaceId: string;
  uploadedById: string;
  createdAt: string;
}

export interface UploadResponse {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  headline: string;
  heading: string | null;
  rank: number;
  space: Pick<Space, 'id' | 'name' | 'slug'>;
  type?: 'page' | 'attachment';
  attachmentMeta?: { attachmentId: string; mimeType: string; pageId: string | null };
}

export interface SearchResponse {
  results: SearchResult[];
  mode: 'semantic' | 'fulltext' | 'trigram';
  expandedQuery: string | null;
  timing: number;
  didYouMean: string | null;
  searchId?: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
