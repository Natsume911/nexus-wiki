import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useState } from 'react';
import { Play, ExternalLink, Edit3 } from 'lucide-react';

function extractEmbedUrl(url: string): string {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  // Loom
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;

  return url;
}

function VideoEmbedView(props: any) {
  const { node, updateAttributes, selected } = props;
  const [editing, setEditing] = useState(!node.attrs.src);
  const [inputUrl, setInputUrl] = useState(node.attrs.src || '');

  const handleSubmit = () => {
    if (inputUrl.trim()) {
      const embedUrl = extractEmbedUrl(inputUrl.trim());
      updateAttributes({ src: embedUrl, originalUrl: inputUrl.trim() });
      setEditing(false);
    }
  };

  if (editing || !node.attrs.src) {
    return (
      <NodeViewWrapper>
        <div className="border border-border-primary rounded-lg p-4 bg-bg-secondary my-2">
          <div className="flex items-center gap-2 mb-3">
            <Play className="h-5 w-5 text-accent" />
            <span className="text-sm font-medium text-text-primary">Incorpora video</span>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Incolla URL YouTube, Vimeo, Loom o iframe..."
              className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              autoFocus
            />
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Incorpora
            </button>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Supporta: YouTube, Vimeo, Loom, o qualsiasi URL iframe
          </p>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div className={`relative my-2 group ${selected ? 'ring-2 ring-accent/40 rounded-lg' : ''}`}>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={node.attrs.src}
            className="absolute inset-0 w-full h-full rounded-lg"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            frameBorder="0"
          />
        </div>
        {/* Edit overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 bg-bg-secondary/90 border border-border-primary rounded-lg text-text-muted hover:text-text-primary"
            contentEditable={false}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          {node.attrs.originalUrl && (
            <a
              href={node.attrs.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-bg-secondary/90 border border-border-primary rounded-lg text-text-muted hover:text-text-primary"
              contentEditable={false}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoEmbed: {
      setVideoEmbed: (attrs?: { src?: string }) => ReturnType;
    };
  }
}

export const VideoEmbed = Node.create({
  name: 'videoEmbed',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      originalUrl: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-video-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-video-embed': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedView);
  },

  addCommands() {
    return {
      setVideoEmbed: (attrs) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: attrs || {},
        });
      },
    };
  },
});
