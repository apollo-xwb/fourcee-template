import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLeadApi, loadConfig } from '../server/lead-api/index.mjs';
import { normaliseSiteUrl, submitAuditRequest, validateAuditRequest } from '../lib/audit-request-client';
import { planHashRoute } from '../lib/hash-route';
import { AppView } from '../types';

const ORIGIN = 'https://fourcee.lutho.app';
let api: Awaited<ReturnType<typeof createLeadApi>> | undefined; let base = ''; let tmp = '';
async function boot() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-req-'));
  api = await createLeadApi(loadConfig({ LEAD_PORT: '0', LEAD_DATA_DIR: tmp, LEAD_ALLOWED_ORIGINS: ORIGIN }), { log: () => {} });
  base = `http://127.0.0.1:${(await api.listen()).port}`;
}
const post = (b: unknown, origin = ORIGIN) => fetch(`${base}/api/audit-request`, { method: 'POST', headers: { 'content-type': 'application/json', origin, connection: 'close' }, body: JSON.stringify(b) });
afterEach(async () => { await api?.close(); api = undefined; });

describe('audit request client', () => {
  it('normalises store URLs', () => {
    expect(normaliseSiteUrl('mystore.co.za')).toBe('https://mystore.co.za/');
    expect(normaliseSiteUrl('http://a.com/x')).toBe('http://a.com/x');
    for (const bad of ['', 'nope', 'javascript:alert(1)', 'http://localhost', 'http://1.2.3.4', 'a b.com']) expect(normaliseSiteUrl(bad)).toBeNull();
  });
  it('validates email and site', () => {
    expect(validateAuditRequest({ email: 'x', site_url: '' })).toEqual({ email: expect.any(String), site_url: expect.any(String) });
    expect(validateAuditRequest({ email: 'a@b.com', site_url: 'b.com' })).toEqual({});
  });
  it('does not treat an SPA HTML 200 as success', async () => {
    const f = (async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;
    expect((await submitAuditRequest({ email: 'a@b.com', site_url: 'b.com', website: '' }, { fetchImpl: f })).status).toBe('error');
  });
  it('routes #/free-audit to the request view and leaves #/audit alone', () => {
    expect(planHashRoute('#/free-audit', false).view).toBe(AppView.AUDIT_REQUEST);
    expect(planHashRoute('#/audit', false).view).toBe(AppView.LEAD_MAGNET);
  });
});

describe('POST /api/audit-request', () => {
  it('stores a valid request and returns 201 ok', async () => {
    await boot();
    const r = await post({ email: 'Owner@Store.example', site_url: 'store.example', idempotency_key: 'k1', website: '' });
    expect(r.status).toBe(201);
    const j = await r.json(); expect(j.ok).toBe(true);
    const rows = JSON.parse(fs.readFileSync(path.join(tmp, 'audit-requests.json'), 'utf8'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: j.id, email: 'owner@store.example', site_url: 'https://store.example/', status: 'requested', auditSentAt: null });
    expect(JSON.stringify(rows)).not.toContain('127.0.0.1'); // raw IP not stored
    // idempotent
    const r2 = await post({ email: 'owner@store.example', site_url: 'store.example', idempotency_key: 'k1' });
    expect((await r2.json()).duplicate).toBe(true);
    // invoice leads untouched
    expect(fs.existsSync(path.join(tmp, 'leads.json')) ? JSON.parse(fs.readFileSync(path.join(tmp, 'leads.json'), 'utf8')) : []).toEqual([]);
  });
  it('rejects bad input, foreign origins, and silently drops honeypot hits', async () => {
    await boot();
    const bad = await post({ email: 'x', site_url: 'localhost' });
    expect(bad.status).toBe(400); expect((await bad.json()).fields).toHaveProperty('email');
    expect((await post({ email: 'a@b.com', site_url: 'b.com' }, 'https://evil.example')).status).toBe(403);
    const hp = await post({ email: 'a@b.com', site_url: 'b.com', website: 'spam' });
    expect(hp.status).toBe(200);
    expect(fs.existsSync(path.join(tmp, 'audit-requests.json')) ? JSON.parse(fs.readFileSync(path.join(tmp, 'audit-requests.json'), 'utf8')) : []).toEqual([]);
  });
});
