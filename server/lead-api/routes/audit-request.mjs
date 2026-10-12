// POST /api/audit-request: free-audit lead magnet (email + store URL). Stored in its own JSON file
// (audit-requests.json in LEAD_DATA_DIR) so it never mixes with invoice leads. Owner notification reuses LEAD_WEBHOOK_URL when set.
import crypto from 'node:crypto';
import path from 'node:path';
import { JsonFileStore } from '../lib/store.mjs';
import { RateLimiter, MIN, HOUR, DAY } from '../lib/ratelimit.mjs';
import { clientIp, send, corsHeaders, readJson } from '../lib/http.mjs';
import { isHoneypotHit } from '../lib/validate.mjs';

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function validateAuditRequest(body) {
  const errors = {};
  const b = body && typeof body === 'object' ? body : {};
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email) || email.includes('..')) errors.email = 'Please enter a valid email address';
  let site = '';
  const raw = typeof b.site_url === 'string' ? b.site_url.trim() : '';
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (raw.length > 300 || !u.hostname.includes('.') || u.username || u.password || /^(localhost|\d+\.\d+\.\d+\.\d+)$/i.test(u.hostname)) throw new Error('bad');
    site = u.toString();
  } catch { errors.site_url = 'Please enter a valid website'; }
  if (Object.keys(errors).length) return { ok: false, errors };
  const key = typeof b.idempotency_key === 'string' ? b.idempotency_key.slice(0, 80) : '';
  const page = typeof b.page_url === 'string' ? b.page_url.slice(0, 300) : '';
  return { ok: true, value: { email: email.toLowerCase(), site_url: site, idempotency_key: key, page_url: page } };
}

export async function createAuditRequestRoute(cfg, { log, fetchImpl, now } = {}) {
  const store = new JsonFileStore(path.join(cfg.dataDir, 'audit-requests.json'));
  await store.init();
  const limiter = new RateLimiter([{ ms: MIN, max: 5 }, { ms: HOUR, max: 20 }, { ms: DAY, max: 50 }], now);
  const route = async (req, res, origin) => {
    const ip = clientIp(req, cfg);
    const rl = limiter.take(ip);
    if (!rl.ok) return send(res, 429, { ok: false, error: 'Too many requests. Please try again shortly.' }, { ...corsHeaders(origin), 'retry-after': String(rl.retryAfterSec) });
    let body;
    try { body = await readJson(req, cfg.maxBodyBytes); } catch (e) { return send(res, e.status || 400, { ok: false, error: e.message }, corsHeaders(origin)); }
    if (isHoneypotHit(body)) { log('audit-request honeypot hit (dropped)'); return send(res, 200, { ok: true, id: crypto.randomUUID() }, corsHeaders(origin)); }
    const v = validateAuditRequest(body);
    if (!v.ok) return send(res, 400, { ok: false, error: 'Validation failed', fields: v.errors }, corsHeaders(origin));
    const dup = await store.findByIdempotencyKey(v.value.idempotency_key);
    if (dup) return send(res, 200, { ok: true, id: dup.id, duplicate: true }, corsHeaders(origin));
    if ((await store.countSince(Date.now() - DAY)) >= cfg.globalPerDay) return send(res, 503, { ok: false, error: 'Service busy. Please email us instead.' }, corsHeaders(origin));
    const rec = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), kind: 'audit_request', ...v.value, status: 'requested', auditSentAt: null,
      ipHash: crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) };
    await store.add(rec); // stored before we answer
    log(`audit-request ${rec.id} stored`);
    if (cfg.webhookUrl) {
      const hb = JSON.stringify({ type: 'audit_request', id: rec.id, email: rec.email, site_url: rec.site_url, createdAt: rec.createdAt });
      const headers = { 'content-type': 'application/json' };
      if (cfg.webhookSecret) headers['x-fourcee-signature'] = `sha256=${crypto.createHmac('sha256', cfg.webhookSecret).update(hb).digest('hex')}`;
      (fetchImpl || fetch)(cfg.webhookUrl, { method: 'POST', headers, body: hb })
        .catch((e) => log(`audit-request ${rec.id} webhook failed: ${e.message}`));
    }
    return send(res, 201, { ok: true, id: rec.id }, corsHeaders(origin));
  };
  route.store = store;
  return route;
}
