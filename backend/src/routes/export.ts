import { Router } from 'express';
import * as pageService from '../services/pageService.js';
import { tiptapToDocx, tiptapToMarkdown } from '../services/exportService.js';
import { error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// GET /api/pages/:id/export/docx
router.get('/pages/:id/export/docx', async (req, res, next) => {
  try {
    const page = await pageService.getPageById(req.params.id as string);
    if (!page) return error(res, 'Pagina non trovata', 404);

    const buffer = await tiptapToDocx(page.content as any, page.title, page.space?.name);
    const filename = `${page.slug}.docx`;

    logAudit(req, { action: 'EXPORT', resourceType: 'PAGE', resourceId: page.id, resourceTitle: page.title, metadata: { format: 'docx' } }).catch(() => {});
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

// GET /api/pages/:id/export/markdown
router.get('/pages/:id/export/markdown', async (req, res, next) => {
  try {
    const page = await pageService.getPageById(req.params.id as string);
    if (!page) return error(res, 'Pagina non trovata', 404);

    const md = `# ${page.title}\n\n${tiptapToMarkdown(page.content as any)}`;

    logAudit(req, { action: 'EXPORT', resourceType: 'PAGE', resourceId: page.id, resourceTitle: page.title, metadata: { format: 'markdown' } }).catch(() => {});
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${page.slug}.md"`);
    res.send(md);
  } catch (err) { next(err); }
});

// GET /api/pages/:id/export/html — for PDF (frontend uses window.print on this)
router.get('/pages/:id/export/html', async (req, res, next) => {
  try {
    const page = await pageService.getPageById(req.params.id as string);
    if (!page) return error(res, 'Pagina non trovata', 404);

    logAudit(req, { action: 'EXPORT', resourceType: 'PAGE', resourceId: page.id, resourceTitle: page.title, metadata: { format: 'html' } }).catch(() => {});
    const html = tiptapJsonToHtml(page.content as any, page.title);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { next(err); }
});

// GET /api/pages/:id/export/pdf
router.get('/pages/:id/export/pdf', async (req, res, next) => {
  try {
    const page = await pageService.getPageById(req.params.id as string);
    if (!page) return error(res, 'Pagina non trovata', 404);

    const html = tiptapJsonToHtml(page.content as any, page.title);
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    const browserPage = await browser.newPage();
    await browserPage.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await browserPage.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });
    await browser.close();

    logAudit(req, { action: 'EXPORT', resourceType: 'PAGE', resourceId: page.id, resourceTitle: page.title, metadata: { format: 'pdf' } }).catch(() => {});
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${page.slug}.pdf"`);
    res.send(Buffer.from(pdf));
  } catch (err) { next(err); }
});

function tiptapJsonToHtml(doc: any, title: string): string {
  const body = renderNodes(doc.content || []);
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1a1a2e; }
  h1 { font-size: 2em; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
  h2 { font-size: 1.5em; margin-top: 1.5em; }
  h3 { font-size: 1.2em; margin-top: 1.2em; }
  pre { background: #f4f4f5; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 0.9em; }
  code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  blockquote { border-left: 3px solid #6366f1; margin-left: 0; padding-left: 16px; color: #555; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f4f4f5; font-weight: 600; }
  img { max-width: 100%; height: auto; border-radius: 8px; }
  hr { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
  .callout { border-left: 4px solid #6366f1; background: #f0f0ff; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${body}
</body>
</html>`;
}

function renderNodes(nodes: any[]): string {
  return (nodes || []).map(renderNode).join('');
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
      const checked = node.attrs?.checked ? '\u2611' : '\u2610';
      return `<li>${checked} ${renderNodes(node.content)}</li>`;
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

function renderInline(content?: any[]): string {
  if (!content) return '';
  return content.map((node) => {
    if (node.type === 'text') {
      let text = escapeHtml(node.text || '');
      for (const mark of (node.marks || [])) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        else if (mark.type === 'italic') text = `<em>${text}</em>`;
        else if (mark.type === 'strike') text = `<s>${text}</s>`;
        else if (mark.type === 'underline') text = `<u>${text}</u>`;
        else if (mark.type === 'code') text = `<code>${text}</code>`;
        else if (mark.type === 'link') text = `<a href="${escapeHtml(mark.attrs?.href || '')}">${text}</a>`;
        else if (mark.type === 'highlight') text = `<mark>${text}</mark>`;
      }
      return text;
    }
    if (node.type === 'hardBreak') return '<br>';
    return renderNode(node);
  }).join('');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default router;
