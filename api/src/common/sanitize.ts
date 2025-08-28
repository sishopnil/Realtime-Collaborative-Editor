// Minimal HTML sanitizer to mitigate XSS in rich text fields
// Strips script/style tags and event handlers; keeps a small safe tag set
const ALLOWED_TAGS = new Set(['b', 'i', 'em', 'strong', 'u', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'span', 'a']);

export function sanitizeHtml(input?: string): string | undefined {
  if (!input) return input;
  let out = input;
  // Remove script and style blocks
  out = out.replace(/<\/(?:script|style)>/gi, '');
  out = out.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove on* event handlers and javascript: URLs
  out = out.replace(/ on[a-z]+="[^"]*"/gi, '');
  out = out.replace(/ on[a-z]+='[^']*'/gi, '');
  out = out.replace(/href\s*=\s*"javascript:[^"]*"/gi, '');
  out = out.replace(/href\s*=\s*'javascript:[^']*'/gi, '');
  // Remove disallowed tags while keeping inner text
  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (m, tag) => {
    const t = String(tag).toLowerCase();
    return ALLOWED_TAGS.has(t) ? m : '';
  });
  return out;
}

export function stripHtml(input?: string): string | undefined {
  if (!input) return input;
  return input.replace(/<[^>]*>/g, '');
}

