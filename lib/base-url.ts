/**
 * Deploy-path helpers. The app is normally served from the site root (BASE_URL = '/'), but it can be built for a sub-path
 * (`VITE_BASE=/fourcee-template/ npm run build`, e.g. https://ops.lutho.app/fourcee-template/). Root-relative URLs written as
 * strings (CSS url(), fetch(), three.js loaders, content.json values) are not rewritten by Vite, so they go through withBase().
 * With the default base '/' every function here returns its input unchanged.
 */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, ''); // '' for '/', '/fourcee-template' for the sub-path build

/** '/assets/x.png' -> '<base>/assets/x.png'. Absolute (https:, data:, blob:), protocol-relative and relative URLs are left alone. */
export function withBase(url: string): string {
  if (!BASE || typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return url;
  if (url === BASE || url.startsWith(`${BASE}/`)) return url; // already prefixed
  return `${BASE}${url}`;
}

/** Walks a parsed JSON value and prefixes string values that point at the app's own /assets/ folder. No-op for base '/'. */
export function rebaseAssetStrings<T>(value: T): T {
  if (!BASE) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v.startsWith('/assets/') ? withBase(v) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
