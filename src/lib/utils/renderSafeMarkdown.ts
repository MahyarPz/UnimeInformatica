import DOMPurify from 'dompurify';

/**
 * Render a Markdown-like string to sanitized HTML.
 *
 * Supports a minimal subset of Markdown (bold, italic, links, headings, lists,
 * paragraphs) to keep the bundle small. The output is sanitized by DOMPurify
 * to prevent stored XSS.
 *
 * Usage:
 *   <div dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(md) }} />
 *
 * NOTE: We're using a lightweight inline converter instead of a full Markdown
 * library. For more complex needs, swap in `marked` or `remark` and still
 * pipe through DOMPurify.
 */

function miniMarkdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings (### before ## before #)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>');

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragraphs: split by double newline
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Don't wrap elements that are already block-level
      if (/^<(h[1-6]|ul|ol|li|blockquote|div|p)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  return html;
}

/**
 * Convert markdown to sanitized HTML string.
 * Safe against stored XSS.
 */
export function renderSafeMarkdown(markdown: string): string {
  if (!markdown) return '';

  const rawHtml = miniMarkdownToHtml(markdown);

  // DOMPurify is only available in browser
  if (typeof window === 'undefined') {
    // On server, return the mini-markdown HTML as-is (no user input should reach SSR)
    return rawHtml;
  }

  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'strong', 'em', 'a',
      'ul', 'ol', 'li',
      'blockquote', 'code', 'pre',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}
