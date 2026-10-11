/**
 * Normalise a request URL so a rebuilt bundle (new content hash) still matches the
 * audit-page baseline captured from commit 16eac5a. Hashed build assets collapse to
 * a stable name; query strings are dropped. Data and blob URLs are ignored.
 */
export function normalizeAuditRequest(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol === 'chrome-extension:') return null;
  // Turnstile's challenge iframe URL embeds a one-time token and is not an app request.
  if (url.hostname === 'challenges.cloudflare.com' && url.pathname.includes('/cdn-cgi/')) return null;
  const path = url.pathname.replace(/\/([^/]+)-[A-Za-z0-9_-]{8,}(\.[a-z0-9]+)$/i, '/$1-*$2');
  return `${url.origin}${path}`;
}

/** Sorted unique normalised URLs. */
export function normalizeAuditRequests(urls: string[]): string[] {
  const set = new Set<string>();
  for (const raw of urls) {
    const next = normalizeAuditRequest(raw);
    if (next) set.add(next);
  }
  return [...set].sort();
}

/** Requests the audit flow is not allowed to grow into (register-interest, new capture APIs). */
export function forbiddenAuditRequest(url: string): boolean {
  return /register-interest|newsletter|waitlist|\/api\/interest|\/api\/subscribe|\/api\/register/i.test(url);
}
