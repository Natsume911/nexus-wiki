/**
 * Prepares page content for email: fetches HTML export, inlines images as base64,
 * applies inline CSS styles (for Outlook compatibility), copies to clipboard,
 * and opens the user's mail client.
 */

const INLINE_STYLES: Record<string, string> = {
  H1: 'font-size:22px;font-weight:700;color:#1a1a2e;border-bottom:2px solid #6366f1;padding-bottom:8px;margin:16px 0 12px;font-family:Segoe UI,Helvetica,Arial,sans-serif;',
  H2: 'font-size:18px;font-weight:600;color:#1a1a2e;margin:20px 0 8px;font-family:Segoe UI,Helvetica,Arial,sans-serif;',
  H3: 'font-size:15px;font-weight:600;color:#1a1a2e;margin:16px 0 6px;font-family:Segoe UI,Helvetica,Arial,sans-serif;',
  P: 'margin:6px 0;line-height:1.6;color:#333;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;',
  UL: 'margin:6px 0;padding-left:24px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;color:#333;',
  OL: 'margin:6px 0;padding-left:24px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;color:#333;',
  LI: 'margin:3px 0;line-height:1.5;',
  BLOCKQUOTE: 'border-left:3px solid #6366f1;padding:8px 16px;margin:12px 0;color:#555;font-style:italic;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;',
  PRE: 'background:#f4f4f5;padding:14px;border-radius:6px;overflow-x:auto;font-size:12px;font-family:Consolas,Monaco,Courier New,monospace;margin:10px 0;line-height:1.4;white-space:pre-wrap;word-break:break-all;',
  CODE: 'background:#f0f0f5;padding:1px 5px;border-radius:3px;font-size:12px;font-family:Consolas,Monaco,Courier New,monospace;color:#d63384;',
  TABLE: 'border-collapse:collapse;width:100%;margin:10px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;',
  TH: 'border:1px solid #d1d5db;padding:8px 12px;background:#f4f4f5;font-weight:600;text-align:left;',
  TD: 'border:1px solid #d1d5db;padding:8px 12px;',
  IMG: 'max-width:100%;height:auto;border-radius:4px;margin:6px 0;display:block;',
  A: 'color:#6366f1;text-decoration:underline;',
  HR: 'border:none;border-top:1px solid #e5e7eb;margin:16px 0;',
  MARK: 'background:#fef08a;padding:1px 3px;border-radius:2px;',
  STRONG: 'font-weight:600;',
  EM: 'font-style:italic;',
  S: 'text-decoration:line-through;',
  U: 'text-decoration:underline;',
};

async function imageToBase64(url: string): Promise<string> {
  try {
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) return url;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

function applyInlineStyles(el: Element): void {
  const tag = el.tagName;
  const style = INLINE_STYLES[tag];
  if (style) {
    const existing = el.getAttribute('style') || '';
    el.setAttribute('style', existing + style);
  }

  // Callout divs
  if (tag === 'DIV' && el.classList.contains('callout')) {
    el.setAttribute(
      'style',
      'border-left:4px solid #6366f1;background:#eef2ff;padding:12px 16px;border-radius:0 6px 6px 0;margin:10px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;color:#333;',
    );
  }

  // Code inside <pre> should not have the inline-code style
  if (tag === 'CODE' && el.parentElement?.tagName === 'PRE') {
    el.setAttribute(
      'style',
      'font-family:Consolas,Monaco,Courier New,monospace;font-size:12px;background:transparent;padding:0;color:inherit;',
    );
  }

  for (const child of Array.from(el.children)) {
    applyInlineStyles(child);
  }
}

export async function prepareEmailContent(
  pageId: string,
  _pageTitle: string,
): Promise<{ html: string; text: string }> {
  // 1. Fetch the backend HTML export (already converts TipTap JSON → clean HTML)
  const resp = await fetch(`/wiki/api/pages/${pageId}/export/html`, {
    credentials: 'include',
  });
  if (!resp.ok) throw new Error('Failed to export page');
  const rawHtml = await resp.text();

  // 2. Parse
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

  // 3. Strip <style> (email clients ignore it — we use inline styles)
  doc.querySelectorAll('style').forEach((s) => s.remove());

  // 4. Apply inline styles to every element
  applyInlineStyles(doc.body);

  // 5. Convert images to inline base64 (so they survive paste into Outlook)
  const images = doc.body.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map(async (img) => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        const absUrl = src.startsWith('http')
          ? src
          : window.location.origin + src;
        img.setAttribute('src', await imageToBase64(absUrl));
      }
    }),
  );

  // 6. Build email-ready HTML wrapper
  const html = `<div style="max-width:680px;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#333;">${doc.body.innerHTML}</div>`;
  const text = doc.body.textContent || '';

  return { html, text };
}

export async function sendPageAsEmail(
  pageId: string,
  pageTitle: string,
): Promise<void> {
  const { html, text } = await prepareEmailContent(pageId, pageTitle);

  // Copy rich HTML to clipboard
  const htmlBlob = new Blob([html], { type: 'text/html' });
  const textBlob = new Blob([text], { type: 'text/plain' });
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': htmlBlob,
      'text/plain': textBlob,
    }),
  ]);

  // Open mail client with subject pre-filled
  window.location.href = `mailto:?subject=${encodeURIComponent(pageTitle)}`;
}
