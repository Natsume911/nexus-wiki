import { Hocuspocus, onAuthenticatePayload, onLoadDocumentPayload, onStoreDocumentPayload } from '@hocuspocus/server';
import * as Y from 'yjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';
import { updateBacklinks } from '../services/backlinkService.js';
import { syncPageChunks } from '../services/chunkingService.js';

const COLLAB_SECRET = process.env.COLLAB_JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') throw new Error('COLLAB_JWT_SECRET is required in production');
  return 'nexus-collab-dev-only-secret';
})();

let hocuspocus: Hocuspocus | null = null;

export function createHocuspocus(): Hocuspocus {
  hocuspocus = new Hocuspocus({
    debounce: 5000,
    maxDebounce: 30000,
    quiet: true,

    async onAuthenticate(data: onAuthenticatePayload) {
      try {
      // Auth via signed JWT only
      const token = data.token;
      if (!token) throw new Error('Token mancante');

      let email: string;
      try {
        const payload = jwt.verify(token, COLLAB_SECRET) as { email: string; userId: string };
        email = payload.email;
      } catch {
        throw new Error('Token JWT non valido');
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) { console.log(`[hocuspocus] user NOT FOUND: ${email}`); throw new Error('Utente non trovato'); }

      const pageId = data.documentName.replace('page:', '');
      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { spaceId: true },
      });
      if (!page) { console.log(`[hocuspocus] page NOT FOUND: ${pageId}`); throw new Error('Pagina non trovata'); }

      // Check user has at least EDITOR role on the space
      const permission = await prisma.spacePermission.findUnique({
        where: { spaceId_userId: { spaceId: page.spaceId, userId: user.id } },
      });

      // Admins always have access; others need EDITOR+
      if (user.role !== 'ADMIN' && (!permission || permission.role === 'VIEWER')) {
        throw new Error('Permesso insufficiente');
      }

      // Store user info for awareness
      if (data.connection) data.connection.readOnly = false;

      return {
        user: { id: user.id, name: user.name, email: user.email },
      };
      } catch (err: any) {
        console.error(`[hocuspocus] AUTH FAILED: ${err.message}`);
        throw err;
      }
    },

    async onLoadDocument(data: onLoadDocumentPayload) {
      const pageId = data.documentName.replace('page:', '');

      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { yjsState: true, content: true },
      });

      if (!page) return;

      if (page.yjsState) {
        const update = new Uint8Array(page.yjsState);
        Y.applyUpdate(data.document, update);
      } else if (page.content && typeof page.content === 'object') {
        // First collaborative access — convert TipTap JSON → Y.Doc
        const tiptapDoc = page.content as { type?: string; content?: unknown[] };
        if (tiptapDoc.content && Array.isArray(tiptapDoc.content)) {
          const yXmlFragment = data.document.getXmlFragment('default');
          tiptapJsonToYFragment(yXmlFragment, tiptapDoc.content);
        }
      }
    },

    async onStoreDocument(data: onStoreDocumentPayload) {
      const pageId = data.documentName.replace('page:', '');

      const yjsState = Buffer.from(Y.encodeStateAsUpdate(data.document));

      // Also convert to TipTap JSON for search, backlinks, and versioning
      // We extract text content from the Y.Doc XML fragment
      const yXmlFragment = data.document.getXmlFragment('default');
      const tiptapContent = yXmlFragmentToSimpleJSON(yXmlFragment);

      try {
        await prisma.page.update({
          where: { id: pageId },
          data: {
            yjsState,
            content: tiptapContent as object,
          },
        });

        // Fire-and-forget: update backlinks and search chunks
        updateBacklinks(pageId, tiptapContent).catch(() => {});
        syncPageChunks(pageId).catch(() => {});
      } catch (err) {
        console.error(`[hocuspocus] store error for ${pageId}:`, err);
      }
    },

    async afterUnloadDocument(data) {
      // Create a version snapshot when all users leave
      const pageId = data.documentName.replace('page:', '');
      try {
        const page = await prisma.page.findUnique({
          where: { id: pageId },
          select: { title: true, content: true, authorId: true },
        });
        if (page && page.content) {
          // Check if last version is recent (avoid spamming versions)
          const lastVersion = await prisma.pageVersion.findFirst({
            where: { pageId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          });
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
          if (!lastVersion || lastVersion.createdAt < fiveMinAgo) {
            await prisma.pageVersion.create({
              data: {
                pageId,
                title: page.title,
                content: page.content as object,
                editedById: page.authorId,
              },
            });
          }
        }
      } catch (err) {
        console.error(`[hocuspocus] version snapshot error for ${pageId}:`, err);
      }
    },
  });

  return hocuspocus;
}

export function getHocuspocus(): Hocuspocus | null {
  return hocuspocus;
}

// ── Helper: Convert TipTap JSON → Y.XmlFragment (for first collab load) ──

function tiptapJsonToYFragment(fragment: Y.XmlFragment, nodes: unknown[]): void {
  for (const node of nodes) {
    const n = node as { type?: string; content?: unknown[]; text?: string; marks?: unknown[]; attrs?: Record<string, unknown> };
    if (!n.type) continue;

    if (n.type === 'text') {
      // Text node → Y.XmlText
      const yText = new Y.XmlText();
      const attrs: Record<string, unknown> = {};
      if (n.marks && Array.isArray(n.marks)) {
        for (const mark of n.marks) {
          const m = mark as { type: string; attrs?: Record<string, unknown> };
          attrs[m.type] = m.attrs || true;
        }
      }
      yText.insert(0, n.text || '', Object.keys(attrs).length > 0 ? attrs : undefined);
      fragment.insert(fragment.length, [yText]);
      continue;
    }

    // Element node → Y.XmlElement
    const yEl = new Y.XmlElement(n.type);

    // Set attributes
    if (n.attrs) {
      for (const [key, val] of Object.entries(n.attrs)) {
        if (val !== null && val !== undefined) {
          yEl.setAttribute(key, typeof val === 'string' ? val : JSON.stringify(val));
        }
      }
    }

    // Recurse into children
    if (n.content && Array.isArray(n.content)) {
      tiptapJsonToYFragment(yEl, n.content);
    }

    fragment.insert(fragment.length, [yEl]);
  }
}

// ── Helper: Convert Y.XmlFragment to simple TipTap-like JSON ────────

function yXmlFragmentToSimpleJSON(fragment: Y.XmlFragment): Record<string, unknown> {
  try {
    const content: Record<string, unknown>[] = [];
    fragment.forEach((child) => {
      const node = yXmlElementToJSON(child);
      if (node) content.push(node);
    });
    return { type: 'doc', content };
  } catch {
    return { type: 'doc', content: [] };
  }
}

function yXmlElementToJSON(element: Y.XmlElement | Y.XmlText): Record<string, unknown> | null {
  if (element instanceof Y.XmlText) {
    const delta = element.toDelta();
    if (delta.length === 0) return null;
    // Convert delta to TipTap text nodes
    const textContent = delta.map((op: { insert?: string; attributes?: Record<string, unknown> }) => {
      if (typeof op.insert === 'string') {
        const node: Record<string, unknown> = { type: 'text', text: op.insert };
        if (op.attributes) {
          node.marks = Object.entries(op.attributes).map(([type, attrs]) => {
            if (typeof attrs === 'boolean' && attrs) return { type };
            return { type, attrs };
          });
        }
        return node;
      }
      return null;
    }).filter(Boolean);
    return { type: 'paragraph', content: textContent };
  }

  const nodeName = element.nodeName;
  const attrs: Record<string, unknown> = {};
  for (const [key, value] of element.getAttributes()) {
    attrs[key] = value;
  }

  const children: Record<string, unknown>[] = [];
  element.forEach((child) => {
    const node = yXmlElementToJSON(child as Y.XmlElement | Y.XmlText);
    if (node) children.push(node);
  });

  const result: Record<string, unknown> = { type: nodeName };
  if (Object.keys(attrs).length > 0) result.attrs = attrs;
  if (children.length > 0) result.content = children;
  return result;
}
