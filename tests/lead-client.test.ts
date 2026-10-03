import { describe, expect, it, vi } from 'vitest';
import { QUEUE_KEY, enqueueLead, flushQueue, leadEndpoint, readQueue, submitLead, validateLeadFields, type LeadPayload } from '../lib/lead-client';
import fs from 'node:fs';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const payload = (o: Partial<LeadPayload> = {}): LeadPayload => ({ name: 'Zoe Test', email: 'zoe@testco.example', phone: '', store: 'Test & Co Jewellers', plan: 'pro', billing_cycle: 'monthly', notes: '', crm: '', total: 5997, currency: 'USD', website: '', idempotency_key: 'key-' + Math.random().toString(36).slice(2, 12), page_url: 'https://x.test/', ...o });
const res = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

describe('validateLeadFields', () => {
  const ok = { name: 'Zoe Test', email: 'zoe@testco.example', phone: '', store: 'Test & Co', plan: 'pro' };
  it('passes a good form (phone optional)', () => expect(validateLeadFields(ok)).toEqual({}));
  it('requires contact name, email, store', () => expect(Object.keys(validateLeadFields({ ...ok, name: '', email: '', store: ' ' })).sort()).toEqual(['email', 'name', 'store']));
  it.each(['nope', 'a@b', 'a b@c.com', 'a@b..com'])('rejects email %s', (email) => expect(validateLeadFields({ ...ok, email }).email).toBeTruthy());
  it('validates phone only when given', () => {
    expect(validateLeadFields({ ...ok, phone: '+27 82 123 4567' }).phone).toBeUndefined();
    expect(validateLeadFields({ ...ok, phone: '12' }).phone).toBeTruthy();
    expect(validateLeadFields({ ...ok, phone: 'call me' }).phone).toBeTruthy();
  });
});

describe('endpoint', () => {
  it('defaults to /api/lead and honours an override', () => { expect(leadEndpoint()).toBe('/api/lead'); expect(leadEndpoint('https://x/api/lead')).toBe('https://x/api/lead'); });
});

describe('submitLead + queue', () => {
  it('POSTs JSON with every field and the idempotency key; success leaves the queue empty', async () => {
    const storage = mem(); const p = payload({ phone: '+27821234567', notes: 'hi' });
    const f = vi.fn().mockResolvedValue(res(201, { ok: true, id: 'srv-1' }));
    const r = await submitLead(p, { fetchImpl: f as unknown as typeof fetch, storage, endpoint: 'https://api.test/api/lead' });
    expect(r).toEqual({ status: 'sent', id: 'srv-1' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.test/api/lead'); expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ name: 'Zoe Test', email: 'zoe@testco.example', phone: '+27821234567', store: 'Test & Co Jewellers', plan: 'pro', notes: 'hi', idempotency_key: p.idempotency_key });
    expect(readQueue(storage)).toEqual([]);
  });
  it.each([[500], [502], [429], [403]])('HTTP %i -> queued (never lost), retryable', async (status) => {
    const storage = mem(); const p = payload();
    const r = await submitLead(p, { fetchImpl: (async () => res(status)) as typeof fetch, storage });
    expect(r.status).toBe('queued');
    expect(readQueue(storage).map((x) => x.idempotency_key)).toEqual([p.idempotency_key]);
  });
  it('network error / timeout -> queued', async () => {
    const storage = mem();
    const r = await submitLead(payload(), { fetchImpl: (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch, storage });
    expect(r.status).toBe('queued'); expect(readQueue(storage)).toHaveLength(1);
  });
  it('400 with field errors -> invalid, not queued', async () => {
    const storage = mem();
    const r = await submitLead(payload(), { fetchImpl: (async () => res(400, { fields: { email: 'bad' } })) as typeof fetch, storage });
    expect(r).toEqual({ status: 'invalid', fields: { email: 'bad' } }); expect(readQueue(storage)).toEqual([]);
  });
  it('retry reuses the same key, de-duplicates the queue, and clears it on success', async () => {
    const storage = mem(); const p = payload(); const keys: string[] = [];
    let fail = true;
    const f = (async (_u: string, init: RequestInit) => { keys.push(JSON.parse(init.body as string).idempotency_key); return fail ? res(503) : res(201, { id: 'a' }); }) as unknown as typeof fetch;
    await submitLead(p, { fetchImpl: f, storage }); await submitLead(p, { fetchImpl: f, storage });
    expect(readQueue(storage)).toHaveLength(1);
    fail = false;
    expect((await submitLead(p, { fetchImpl: f, storage })).status).toBe('sent');
    expect(readQueue(storage)).toEqual([]); expect(new Set(keys).size).toBe(1);
  });
  it('flushQueue delivers queued leads in order, stops while still offline, keeps the rest', async () => {
    const storage = mem(); const a = payload(), b = payload(), c = payload();
    [a, b, c].forEach((x) => enqueueLead(x, storage));
    let calls = 0;
    const f = (async () => (++calls <= 1 ? res(201, { id: 'x' }) : res(500))) as unknown as typeof fetch;
    expect(await flushQueue({ fetchImpl: f, storage })).toBe(1);
    expect(readQueue(storage).map((x) => x.idempotency_key)).toEqual([b.idempotency_key, c.idempotency_key]);
    expect(await flushQueue({ fetchImpl: (async () => res(201, { id: 'y' })) as unknown as typeof fetch, storage })).toBe(2);
    expect(readQueue(storage)).toEqual([]);
  });
  it('survives a corrupt queue value and a missing storage', async () => {
    const storage = mem(); storage.setItem(QUEUE_KEY, '{not json');
    expect(readQueue(storage)).toEqual([]);
    const r = await submitLead(payload(), { fetchImpl: (async () => res(500)) as typeof fetch, storage: null });
    expect(r.status).toBe('queued');
  });
});

describe('mobile input rule (iOS focus-zoom)', () => {
  const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  it('index.css forces >=16px on input/textarea/select for narrow or touch viewports', () => {
    expect(css).toMatch(/@media \(max-width: 767px\), \(pointer: coarse\)[\s\S]*textarea[\s\S]*select[\s\S]*font-size: 16px !important/);
  });
  it('viewport meta never disables pinch-zoom', () => {
    const meta = /<meta name="viewport" content="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(meta).toContain('width=device-width');
    expect(meta).not.toMatch(/maximum-scale|user-scalable\s*=\s*(no|0)|minimum-scale/);
  });
});
