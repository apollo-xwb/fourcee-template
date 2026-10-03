import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createChatProxy, loadConfig, validateMessages, RateLimiter, buildSystemPrompt, DEFAULT_MODELS } from '../server/chat-proxy.mjs';

const KEY = 'sk-or-test-SECRET-123456789';
type Behaviour = 'ok' | 'http500' | 'http429' | 'hang' | 'empty' | 'midstream-error' | 'ok-then-stall';
let behaviours: Record<string, Behaviour> = {};
let seen: { model: string; auth: string | undefined; referer: unknown; title: unknown; body: any }[] = [];
let mock: http.Server; let mockUrl = '';

const sse = (res: http.ServerResponse, parts: unknown[]) => { for (const p of parts) res.write(typeof p === 'string' ? p : `data: ${JSON.stringify(p)}\n\n`); };
const chunk = (t: string) => ({ choices: [{ delta: { content: t } }] });

beforeAll(async () => {
  mock = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      const body = JSON.parse(b || '{}'); const model = body.model as string;
      seen.push({ model, auth: req.headers.authorization, referer: req.headers['http-referer'], title: req.headers['x-title'], body });
      const beh = behaviours[model] || 'ok';
      if (beh === 'http500') { res.writeHead(500, { 'content-type': 'application/json' }); return void res.end('{"error":{"message":"boom sk-or-LEAK"}}'); }
      if (beh === 'http429') { res.writeHead(429); return void res.end('{}'); }
      if (beh === 'hang') return; // never answers
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      if (beh === 'empty') { sse(res, [': OPENROUTER PROCESSING\n\n', 'data: [DONE]\n\n']); return void res.end(); }
      if (beh === 'midstream-error') { sse(res, [chunk('Hello '), { error: { code: 502, message: 'provider died' } }]); return void res.end(); }
      if (beh === 'ok-then-stall') { sse(res, [chunk('Part one. ')]); return; }
      sse(res, [': OPENROUTER PROCESSING\n\n', chunk(`from ${model}: `), chunk('stream'), chunk('ed.'), { choices: [{ delta: {}, finish_reason: 'stop' }] }, 'data: [DONE]\n\n']);
      res.end();
    });
  });
  await new Promise<void>((r) => mock.listen(0, '127.0.0.1', r));
  mockUrl = `http://127.0.0.1:${(mock.address() as AddressInfo).port}/api/v1`;
});
afterAll(() => new Promise<void>((r) => mock.close(() => r())));
beforeEach(() => { behaviours = {}; seen = []; });

async function start(over: Record<string, unknown> = {}) {
  const logs: any[] = [];
  const { server, cfg } = createChatProxy(<any>{ apiKey: KEY, baseUrl: mockUrl, models: ['m/a', 'm/b', 'm/c'], firstByteMs: 400, totalMs: 3000, ratePerMin: 5, ratePerDay: 50, log: (o: any) => logs.push(o), ...over });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, logs, cfg, close: () => new Promise<void>((r) => { server.closeAllConnections?.(); server.close(() => r()); }) };
}
const post = (base: string, body: unknown, headers: Record<string, string> = {}) => fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const events = async (res: Response) => (await res.text()).split('\n\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));
const ask = { messages: [{ role: 'user', content: 'How much is Pro?' }] };

describe('chat proxy: happy path + key hygiene', () => {
  it('streams SSE deltas from the first model and ends with done+model', async () => {
    const p = await start();
    const res = await post(p.base, ask);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const ev = await events(res);
    expect(ev.filter((e) => e.delta).map((e) => e.delta).join('')).toBe('from m/a: streamed.');
    expect(ev.at(-1)).toEqual({ done: true, model: 'm/a' });
    await p.close();
  });
  it('sends the key, referer and title upstream ONLY; the response and the logs never contain the key', async () => {
    const p = await start();
    const res = await post(p.base, ask); const text = await res.text();
    expect(seen[0].auth).toBe(`Bearer ${KEY}`);
    expect(seen[0].referer).toBe('https://fourcee.lutho.app'); expect(seen[0].title).toBeTruthy();
    expect(text).not.toContain(KEY); expect(JSON.stringify(p.logs)).not.toContain(KEY);
    for (const [k, v] of res.headers) expect(`${k}:${v}`).not.toContain(KEY);
    await p.close();
  });
  it('upstream request: stream=true, system prompt grounded in the KB first, user text last, bounded tokens', async () => {
    const p = await start(); await (await post(p.base, ask)).text();
    const b = seen[0].body;
    expect(b.stream).toBe(true); expect(b.max_tokens).toBeLessThanOrEqual(450);
    expect(b.messages[0].role).toBe('system'); expect(b.messages[0].content).toContain('FACTS:'); expect(b.messages[0].content).toContain('Starter');
    expect(b.messages.at(-1)).toEqual({ role: 'user', content: 'How much is Pro?' });
    await p.close();
  });
  it('the system prompt is built from the same KB the page uses and never contains a key-like string', () => {
    expect(buildSystemPrompt()).not.toMatch(/sk-or-/);
    expect(DEFAULT_MODELS.length).toBeGreaterThanOrEqual(3);
  });
});

describe('chat proxy: model fallback and timeouts', () => {
  it('falls back to the next model on HTTP 500 and on 429 before any token', async () => {
    behaviours = { 'm/a': 'http500', 'm/b': 'http429' };
    const p = await start();
    const ev = await events(await post(p.base, ask));
    expect(ev.at(-1)).toEqual({ done: true, model: 'm/c' });
    expect(seen.map((s) => s.model)).toEqual(['m/a', 'm/b', 'm/c']);
    expect(JSON.stringify(ev)).not.toContain('LEAK'); // upstream error bodies never reach the browser
    await p.close();
  });
  it('first-byte timeout on a hanging model moves on to the next one', async () => {
    behaviours = { 'm/a': 'hang' };
    const p = await start(); const t0 = Date.now();
    const ev = await events(await post(p.base, ask));
    expect(ev.at(-1)).toEqual({ done: true, model: 'm/b' });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(380); expect(Date.now() - t0).toBeLessThan(2500);
    await p.close();
  });
  it('an empty stream counts as a failure and falls back', async () => {
    behaviours = { 'm/a': 'empty' };
    const p = await start(); const ev = await events(await post(p.base, ask));
    expect(ev.at(-1)).toEqual({ done: true, model: 'm/b' }); await p.close();
  });
  it('a mid-stream provider error before the first delta is sent falls back; after a delta it ends cleanly with the partial text', async () => {
    behaviours = { 'm/a': 'midstream-error', 'm/b': 'midstream-error', 'm/c': 'midstream-error' };
    const p = await start(); const ev = await events(await post(p.base, ask));
    expect(ev.filter((e) => e.delta).map((e) => e.delta).join('')).toBe('Hello ');
    expect(ev.at(-1)).toEqual({ error: 'interrupted' });
    expect(seen.map((s) => s.model)).toEqual(['m/a']); // already streaming: no second model glued onto the partial answer
    await p.close();
  });
  it('all models failing degrades to a JSON 503 (page falls back to its local answers) with no upstream details', async () => {
    behaviours = { 'm/a': 'http500', 'm/b': 'http500', 'm/c': 'http500' };
    const p = await start(); const res = await post(p.base, ask);
    expect(res.status).toBe(503); expect(await res.json()).toEqual({ error: 'all_models_failed' }); await p.close();
  });
  it('total timeout returns 504 if nothing was streamed; if a token was sent it ends the stream cleanly', async () => {
    behaviours = { 'm/a': 'hang', 'm/b': 'hang', 'm/c': 'hang' };
    const p = await start({ firstByteMs: 5000, totalMs: 500 });
    expect((await post(p.base, ask)).status).toBe(504); await p.close();
    behaviours = { 'm/a': 'ok-then-stall' };
    const q = await start({ firstByteMs: 5000, totalMs: 600 });
    const ev = await events(await post(q.base, ask));
    expect(ev[0]).toEqual({ delta: 'Part one. ' }); expect(ev.at(-1)).toEqual({ error: 'interrupted' }); await q.close();
  });
});

describe('chat proxy: protection', () => {
  it('rate limit: 429 with Retry-After after the per-minute budget; the upstream is not called for rejected requests', async () => {
    const p = await start({ ratePerMin: 3 });
    for (let i = 0; i < 3; i++) expect((await post(p.base, ask)).status).toBe(200);
    const n = seen.length; const r = await post(p.base, ask);
    expect(r.status).toBe(429); expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0); expect(seen.length).toBe(n);
    await p.close();
  });
  it('RateLimiter: per-minute window slides, per-day cap holds, keys are independent', () => {
    let t = 1_000_000; const rl = new RateLimiter({ perMin: 2, perDay: 3, now: () => t });
    expect(rl.take('a').ok).toBe(true); expect(rl.take('a').ok).toBe(true); expect(rl.take('a').ok).toBe(false); expect(rl.take('b').ok).toBe(true);
    t += 61_000; expect(rl.take('a').ok).toBe(true); // 3rd of the day
    t += 61_000; const d = rl.take('a'); expect(d.ok).toBe(false); expect((d as any).retryAfterS).toBeGreaterThan(3600);
  });
  it('validation: shape, size, roles, last message must be the user, history trimmed', async () => {
    const cfg = loadConfig({});
    expect(validateMessages({}, cfg).error).toBe('messages_required');
    expect(validateMessages({ messages: [{ role: 'system', content: 'x' }] }, cfg).error).toBe('message_shape');
    expect(validateMessages({ messages: [{ role: 'user', content: 'x'.repeat(2001) }] }, cfg).error).toBe('message_too_long');
    expect(validateMessages({ messages: [{ role: 'assistant', content: 'hi' }] }, cfg).error).toBe('last_must_be_user');
    const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })).concat([{ role: 'user', content: 'last' }]);
    const v = validateMessages({ messages: many.slice(-31) }, cfg); expect(v.messages.length).toBeLessThanOrEqual(12); expect(v.messages[0].role).toBe('user'); expect(v.messages.at(-1).content).toBe('last');
    const p = await start();
    expect((await post(p.base, '{nope')).status).toBe(400);
    expect((await post(p.base, { messages: [] })).status).toBe(400);
    expect((await fetch(`${p.base}/api/chat`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' })).status).toBe(415);
    expect((await fetch(`${p.base}/api/chat`)).status).toBe(405);
    expect((await post(p.base, { messages: [{ role: 'user', content: 'x'.repeat(40_000) }] })).status).toBe(413);
    expect(seen.length).toBe(0); await p.close();
  });
  it('Origin allow-list: foreign origin 403, same-origin (no Origin) and the site origin pass', async () => {
    const p = await start({ ratePerMin: 50 });
    expect((await post(p.base, ask, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await post(p.base, ask, { origin: 'https://fourcee.lutho.app' })).status).toBe(200);
    expect((await post(p.base, ask)).status).toBe(200); await p.close();
  });
  it('no key configured: health says enabled:false and chat answers 503 chat_disabled without calling upstream', async () => {
    const p = await start({ apiKey: '' });
    expect(await (await fetch(`${p.base}/api/chat/health`)).json()).toEqual({ enabled: false, models: 3 });
    const r = await post(p.base, ask); expect(r.status).toBe(503); expect(await r.json()).toEqual({ error: 'chat_disabled' }); expect(seen.length).toBe(0); await p.close();
  });
  it('concurrency cap: the 3rd simultaneous request gets 503 busy', async () => {
    behaviours = { 'm/a': 'hang', 'm/b': 'hang', 'm/c': 'hang' };
    const p = await start({ maxInflight: 2, firstByteMs: 5000, totalMs: 1500, ratePerMin: 50 });
    const a = post(p.base, ask), b = post(p.base, ask); await new Promise((r) => setTimeout(r, 150));
    const c = await post(p.base, ask); expect(c.status).toBe(503); expect(await c.json()).toEqual({ error: 'busy' });
    await Promise.allSettled([a, b]); await p.close();
  });
  it('client disconnect aborts the upstream request', async () => {
    behaviours = { 'm/a': 'ok-then-stall' };
    const p = await start({ totalMs: 20_000, firstByteMs: 5000 });
    const ac = new AbortController(); const res = await fetch(`${p.base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ask), signal: ac.signal });
    await res.body!.getReader().read(); ac.abort();
    await new Promise((r) => setTimeout(r, 300));
    expect(p.logs.some((l: any) => l.ev === 'chat_abort')).toBe(true); await p.close();
  });
});
