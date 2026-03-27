import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Plugin to rewrite /uploads/... → /wiki/uploads/... so the existing proxy catches it.
// Vite's base path (/wiki/) rejects requests outside the base before proxying,
// so we intercept early and rewrite.
function uploadsRewritePlugin() {
  return {
    name: 'uploads-rewrite',
    configureServer(server: { middlewares: { use: (fn: Function) => void } }) {
      server.middlewares.use((req: { url?: string }, _res: unknown, next: () => void) => {
        if (req.url?.startsWith('/uploads/')) {
          req.url = '/wiki' + req.url;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [uploadsRewritePlugin(), react(), tailwindcss()],
  base: '/wiki/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-editor': [
            '@tiptap/core', '@tiptap/react', '@tiptap/starter-kit', '@tiptap/pm',
            '@tiptap/extension-collaboration', '@tiptap/extension-collaboration-cursor',
            '@tiptap/extension-code-block-lowlight', '@tiptap/extension-table',
            '@tiptap/extension-image', '@tiptap/extension-link',
            '@tiptap/extension-task-list', '@tiptap/extension-task-item',
            'yjs', 'y-prosemirror', 'y-protocols', 'lowlight', 'highlight.js',
          ],
          'vendor-ui': [
            'framer-motion', 'lucide-react',
            '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tooltip', '@radix-ui/react-scroll-area',
          ],
          'vendor-heavy': [
            'mermaid', 'katex', 'react-force-graph-2d',
          ],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: true,
    allowedHosts: true,
    proxy: {
      '/wiki/api': {
        target: 'http://nexus-backend:4000',
        rewrite: (path) => path.replace(/^\/wiki\/api/, '/api'),
        changeOrigin: true,
        timeout: 300000, // 5 min — AI operations (translate, meeting notes) can be slow
      },
      '/wiki/uploads': {
        target: 'http://nexus-backend:4000',
        rewrite: (path) => path.replace(/^\/wiki\/uploads/, '/uploads'),
        changeOrigin: true,
      },
      '/wiki/socket.io': {
        target: 'http://nexus-backend:4000',
        rewrite: (path) => path.replace(/^\/wiki\/socket\.io/, '/socket.io'),
        changeOrigin: true,
        ws: true,
      },
      '/wiki/collaboration': {
        target: 'http://nexus-backend:4001',
        rewrite: (path) => path.replace(/^\/wiki\/collaboration/, ''),
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
