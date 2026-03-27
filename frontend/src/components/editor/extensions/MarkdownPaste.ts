import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { marked } from 'marked';

/**
 * Detects if pasted text looks like Markdown and converts it to HTML
 * so TipTap can parse it as rich content.
 */
function looksLikeMarkdown(text: string): boolean {
  // Check for common markdown patterns
  const patterns = [
    /^#{1,6}\s/m,           // headings
    /^\*\s/m,               // unordered list
    /^-\s/m,                // unordered list
    /^\d+\.\s/m,            // ordered list
    /\*\*[^*]+\*\*/,        // bold
    /\*[^*]+\*/,            // italic
    /`[^`]+`/,              // inline code
    /```[\s\S]*?```/,       // code blocks
    /^\|.*\|/m,             // tables
    /^>/m,                  // blockquotes
    /\[.+\]\(.+\)/,         // links
    /!\[.*\]\(.+\)/,        // images
    /^---$/m,               // horizontal rule
    /^- \[[ x]\]/m,         // task lists
  ];

  let matchCount = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) matchCount++;
  }

  // Need at least 2 markdown patterns to avoid false positives
  return matchCount >= 2;
}

export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            // Only intercept plain text (if HTML is available, let TipTap handle it natively)
            const html = clipboardData.getData('text/html');
            if (html) return false;

            const text = clipboardData.getData('text/plain');
            if (!text || !looksLikeMarkdown(text)) return false;

            // Convert markdown to HTML
            const converted = marked.parse(text, { async: false }) as string;
            if (!converted || converted === text) return false;

            // Insert as HTML content
            editor.commands.insertContent(converted);

            return true;
          },
        },
      }),
    ];
  },
});
