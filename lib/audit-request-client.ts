/**
 * Free-audit lead magnet: a visitor gives an email + store URL and asks for an audit.
 * POSTs to /api/audit-request (server/lead-api/routes/audit-request.mjs). Success is ONLY a JSON {ok:true};
 * the UI then says "we'll send your audit", never that an audit has already been sent.
 */
import { isJsonContentType, newIdempotencyKey } from './lead-client';

export interface AuditRequestFields { email: string; site_url: string; website: string /* honeypot */ }
export type AuditRequestErrors = Partial<Record<'email' | 'site_url', string>>;
export type AuditRequestResult =
  | { status: 'sent'; id: string }
  | { status: 'error'; error: string }
  | { status: 'invalid'; fields: AuditRequestErrors };

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

/** Accepts "mystore.com" or "https://mystore.com/x"; returns a normalised https URL or null. */
export function normaliseSiteUrl(input: string): string | null {
  const t = input.trim();
  if (!t || t.length > 300 || /\s/.test(t)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') || u.username || u.password) return null;
    if (/^(localhost|\d+\.\d+\.\d+\.\d+)$/i.test(u.hostname)) return null;
    return u.toString();
  } catch { return null; }
}

export function validateAuditRequest(f: Pick<AuditRequestFields, 'email' | 'site_url'>): AuditRequestErrors {
  const e: AuditRequestErrors = {};
  const email = f.email.trim();
  if (!email) e.email = 'Please enter your email address';
  else if (!EMAIL_RE.test(email) || email.includes('..')) e.email = 'Please enter a valid email address';
  if (!f.site_url.trim()) e.site_url = 'Please enter your store’s website';
  else if (!normaliseSiteUrl(f.site_url)) e.site_url = 'Please enter a valid website, e.g. yourstore.com';
  return e;
}

export async function submitAuditRequest(
  f: AuditRequestFields,
  o: { endpoint?: string; fetchImpl?: typeof fetch; idempotencyKey?: string } = {},
): Promise<AuditRequestResult> {
  const errs = validateAuditRequest(f);
  if (Object.keys(errs).length) return { status: 'invalid', fields: errs };
  const body = {
    email: f.email.trim(), site_url: normaliseSiteUrl(f.site_url), website: f.website,
    idempotency_key: o.idempotencyKey || newIdempotencyKey(),
    page_url: typeof location !== 'undefined' ? location.href.slice(0, 300) : '',
  };
  try {
    const res = await (o.fetchImpl ?? fetch)(o.endpoint || '/api/audit-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
    });
    const j = isJsonContentType(res.headers.get('content-type')) ? await res.json().catch(() => null) : null;
    if (res.ok && j && j.ok === true) return { status: 'sent', id: String(j.id || body.idempotency_key) };
    if (res.status === 400 && j?.fields) return { status: 'invalid', fields: j.fields };
    if (res.status === 429) return { status: 'error', error: 'Too many requests right now. Please retry in a minute.' };
    return { status: 'error', error: 'We could not confirm your request. Please try again.' };
  } catch {
    return { status: 'error', error: 'We could not reach our server. Check your connection and try again.' };
  }
}
