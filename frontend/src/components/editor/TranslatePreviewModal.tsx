import { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Copy, Mail, Loader2, Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { translatePage } from '@/api/ai';
import { useToastStore } from '@/stores/toastStore';
import { useT } from '@/i18n';

interface TranslatePreviewModalProps {
  open: boolean;
  content: Record<string, unknown> | null;
  title: string;
  langLabel: string;
  pageId: string;
  targetLang: string;
  onClose: () => void;
  onApplied: () => void;
}

// ---- Lightweight TipTap JSON → HTML renderer ----

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderInline(content?: any[]): string {
  if (!content) return '';
  return content.map((node) => {
    if (node.type === 'text') {
      let text = escapeHtml(node.text || '');
      for (const mark of node.marks || []) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        else if (mark.type === 'italic') text = `<em>${text}</em>`;
        else if (mark.type === 'strike') text = `<s>${text}</s>`;
        else if (mark.type === 'underline') text = `<u>${text}</u>`;
        else if (mark.type === 'code') text = `<code>${text}</code>`;
        else if (mark.type === 'link') text = `<a href="${escapeHtml(mark.attrs?.href || '')}" target="_blank" rel="noopener">${text}</a>`;
        else if (mark.type === 'highlight') text = `<mark>${text}</mark>`;
      }
      return text;
    }
    if (node.type === 'hardBreak') return '<br>';
    return renderNode(node);
  }).join('');
}

function renderNode(node: any): string {
  switch (node.type) {
    case 'paragraph': return `<p>${renderInline(node.content)}</p>`;
    case 'heading': return `<h${node.attrs?.level || 1}>${renderInline(node.content)}</h${node.attrs?.level || 1}>`;
    case 'bulletList': return `<ul>${renderNodes(node.content)}</ul>`;
    case 'orderedList': return `<ol>${renderNodes(node.content)}</ol>`;
    case 'listItem': return `<li>${renderNodes(node.content)}</li>`;
    case 'taskList': return `<ul style="list-style:none;padding-left:0">${renderNodes(node.content)}</ul>`;
    case 'taskItem': {
      const ch = node.attrs?.checked ? '\u2611' : '\u2610';
      return `<li>${ch} ${renderNodes(node.content)}</li>`;
    }
    case 'blockquote': return `<blockquote>${renderNodes(node.content)}</blockquote>`;
    case 'codeBlock': {
      const text = (node.content || []).map((n: any) => n.text || '').join('');
      return `<pre><code>${escapeHtml(text)}</code></pre>`;
    }
    case 'horizontalRule': return '<hr>';
    case 'image': return `<img src="${escapeHtml(node.attrs?.src || '')}" alt="${escapeHtml(node.attrs?.alt || '')}">`;
    case 'table': return `<table>${renderNodes(node.content)}</table>`;
    case 'tableRow': return `<tr>${renderNodes(node.content)}</tr>`;
    case 'tableHeader': return `<th>${renderNodes(node.content)}</th>`;
    case 'tableCell': return `<td>${renderNodes(node.content)}</td>`;
    case 'callout': return `<div class="callout"><strong>${escapeHtml((node.attrs?.type || 'info').toUpperCase())}:</strong> ${renderNodes(node.content)}</div>`;
    default: return renderInline(node.content);
  }
}

function renderNodes(nodes: any[]): string {
  return (nodes || []).map(renderNode).join('');
}

function tiptapToHtml(doc: Record<string, unknown>): string {
  return renderNodes((doc as any).content || []);
}

// ---- Component ----

export function TranslatePreviewModal({ open, content, title, langLabel, pageId, targetLang, onClose, onApplied }: TranslatePreviewModalProps) {
  const [copying, setCopying] = useState(false);
  const [applying, setApplying] = useState(false);
  const { addToast } = useToastStore();
  const t = useT();

  const handleApply = async () => {
    setApplying(true);
    try {
      await translatePage(pageId, targetLang);
      addToast(t('translate.applied'), 'success');
      onApplied();
    } catch (err: any) {
      addToast(err.message || t('common.error'), 'error');
    } finally {
      setApplying(false);
    }
  };

  const html = useMemo(() => {
    if (!content) return '';
    return tiptapToHtml(content);
  }, [content]);

  const handleCopy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(
        new DOMParser().parseFromString(html, 'text/html').body.textContent || '',
      );
      addToast(t('translate.preview.copied'), 'success');
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setCopying(false);
    }
  };

  return (
    <Dialog.Root open={open && !!content} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex flex-col rounded-2xl border border-border-primary bg-bg-primary shadow-2xl overflow-hidden focus:outline-none">
          <Dialog.Title className="sr-only">{t('translate.preview.title', { lang: langLabel })}</Dialog.Title>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary bg-bg-secondary shrink-0">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-accent" />
              <h2 className="font-display font-semibold text-text-primary">
                {t('translate.preview.title', { lang: langLabel })}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">
                {t('translate.preview.badge')}
              </span>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 md:px-12 lg:px-20">
            <div className="max-w-3xl mx-auto">
              <h1 className="text-3xl font-display font-bold text-text-primary mb-6 pb-3 border-b-2 border-accent">
                {title}
              </h1>
              <div
                className="prose prose-sm dark:prose-invert max-w-none
                  [&_h1]:text-2xl [&_h1]:font-display [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4
                  [&_h2]:text-xl [&_h2]:font-display [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3
                  [&_h3]:text-lg [&_h3]:font-display [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2
                  [&_p]:text-text-secondary [&_p]:leading-relaxed [&_p]:my-2
                  [&_a]:text-accent [&_a]:underline
                  [&_pre]:bg-bg-tertiary [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:text-sm
                  [&_code]:bg-bg-tertiary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:text-pink-400
                  [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-text-secondary
                  [&_blockquote]:border-l-3 [&_blockquote]:border-accent [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-muted
                  [&_table]:w-full [&_table]:border-collapse
                  [&_th]:border [&_th]:border-border-primary [&_th]:px-3 [&_th]:py-2 [&_th]:bg-bg-secondary [&_th]:font-semibold [&_th]:text-left
                  [&_td]:border [&_td]:border-border-primary [&_td]:px-3 [&_td]:py-2
                  [&_img]:max-w-full [&_img]:rounded-lg
                  [&_hr]:border-border-primary [&_hr]:my-6
                  [&_mark]:bg-yellow-200/50 [&_mark]:px-1 [&_mark]:rounded
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
                  [&_li]:my-1 [&_li]:text-text-secondary
                  [&_.callout]:border-l-4 [&_.callout]:border-accent [&_.callout]:bg-accent/5 [&_.callout]:px-4 [&_.callout]:py-3 [&_.callout]:rounded-r-lg [&_.callout]:my-3"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border-primary bg-bg-secondary shrink-0">
            <p className="text-xs text-text-muted">
              {t('translate.preview.hint')}
            </p>
            <div className="flex items-center gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm">
                  {t('common.close')}
                </Button>
              </Dialog.Close>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={copying}
              >
                {copying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {t('common.copy')}
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={applying}
                className="bg-accent hover:bg-accent-hover"
              >
                {applying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                {t('translate.apply')}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
