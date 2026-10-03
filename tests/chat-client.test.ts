import { beforeEach, describe, expect, it } from 'vitest';
import { ChatUnavailable, chatProxyEnabled, parseSse, resetChatHealthCache, streamChat } from '../lib/chat-client';
import { escapeHtml, formatChatText, getFallbackResponse, CHAT_KNOWLEDGE_BASE } from '../components/ui/chat-knowledge-base';

const enc = new TextEncoder();
const body = (parts: string[], delayMs = 0, hangAfter = false) => new ReadableStream<Uint8Array>({
  async start(c) { for (const p of parts) { if (delayMs) await new Promise((r) => setTimeout(r, delayMs)); c.enqueue(enc.encode(p)); } if (!hangAfter) c.close(); },
});
const sseRes = (parts: string[], init: ResponseInit = {}, delay = 0, hang = false) => new Response(body(parts, delay, hang), { status: 200, headers: { 'content-type': 'text/event-stream' }, ...init });
const fr = (d: string) => `data: ${JSON.stringify({ delta: d })}\n\n`;
const msgs = [{ role: 'user' as const, content: 'hi' }];

describe('parseSse', () => {
  it('reassembles frames split across chunks and CRLF', async () => {
    const out: any[] = [];
    const chunks = ['data: {"delta":"He', 'llo"}\r\n\r\ndata: {"del', 'ta":" you"}\n\n: comment\n\ndata: {"done":true,"model":"m/a"}\n\n'];
    for await (const e of parseSse(body(chunks))) out.push(e);
    expect(out).toEqual([{ delta: 'Hello' }, { delta: ' you' }, { done: true, model: 'm/a' }]);
  });
});

describe('streamChat', () => {
  it('streams progressively and reports the model', async () => {
    const seen: string[] = [];
    const r = await streamChat({ messages: msgs, onDelta: (t) => seen.push(t), fetchImpl: (async () => sseRes([fr('A'), fr('B'), `data: ${JSON.stringify({ done: true, model: 'm/x' })}\n\n`])) as any });
    expect(seen).toEqual(['A', 'AB']); expect(r).toEqual({ text: 'AB', interrupted: false, model: 'm/x' });
  });
  it('never sends anything but the conversation (no key, no provider fields)', async () => {
    let sent: any; await streamChat({ messages: msgs, onDelta: () => {}, fetchImpl: (async (_u: string, init: RequestInit) => { sent = init; return sseRes([fr('x')]); }) as any });
    expect(Object.keys(JSON.parse(sent.body))).toEqual(['messages']); expect(JSON.stringify(sent.headers)).not.toMatch(/authorization|bearer|key/i);
  });
  it.each([[503, { error: 'chat_disabled' }, 'disabled'], [503, { error: 'busy' }, 'busy'], [503, { error: 'all_models_failed' }, 'failed'], [504, { error: 'timeout' }, 'timeout'], [500, {}, 'failed']] as const)('HTTP %s %j -> ChatUnavailable(%s)', async (st, j, why) => {
    await expect(streamChat({ messages: msgs, onDelta: () => {}, fetchImpl: (async () => new Response(JSON.stringify(j), { status: st, headers: { 'content-type': 'application/json' } })) as any })).rejects.toMatchObject({ reason: why });
  });
  it('429 carries Retry-After', async () => {
    await expect(streamChat({ messages: msgs, onDelta: () => {}, fetchImpl: (async () => new Response('{}', { status: 429, headers: { 'retry-after': '17', 'content-type': 'application/json' } })) as any })).rejects.toMatchObject({ reason: 'rate_limited', retryAfterS: 17 });
  });
  it('an HTML page (SPA fallback, proxy not routed) is rejected as bad_response, not rendered', async () => {
    await expect(streamChat({ messages: msgs, onDelta: () => {}, fetchImpl: (async () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } })) as any })).rejects.toMatchObject({ reason: 'bad_response' });
  });
  it('network failure and first-token timeout both degrade (caller falls back to local answers)', async () => {
    await expect(streamChat({ messages: msgs, onDelta: () => {}, fetchImpl: (async () => { throw new TypeError('fetch failed'); }) as any })).rejects.toBeInstanceOf(ChatUnavailable);
    const hang = (async (_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))) as any;
    await expect(streamChat({ messages: msgs, onDelta: () => {}, fetchImpl: hang, firstTokenMs: 80 })).rejects.toMatchObject({ reason: 'timeout' });
  });
  it('a stream that stalls after some text is cut at the total timeout and returned as interrupted (partial kept)', async () => {
    const stalling = (async (_u: string, init: RequestInit) => new Response(new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(enc.encode(fr('Part'))); init.signal!.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError'))); },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } })) as any;
    const r = await streamChat({ messages: msgs, onDelta: () => {}, firstTokenMs: 1000, totalMs: 200, fetchImpl: stalling });
    expect(r.text).toBe('Part'); expect(r.interrupted).toBe(true);
  });
  it('server-side interruption event marks the answer interrupted', async () => {
    const r = await streamChat({ messages: msgs, onDelta: () => {}, fetchImpl: (async () => sseRes([fr('Hello '), `data: ${JSON.stringify({ error: 'interrupted' })}\n\n`])) as any });
    expect(r).toMatchObject({ text: 'Hello ', interrupted: true });
  });
  it('caller abort rejects', async () => {
    const ac = new AbortController(); const hang = (async (_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('a', 'AbortError'))))) as any;
    const p = streamChat({ messages: msgs, onDelta: () => {}, fetchImpl: hang, signal: ac.signal }); ac.abort(); await expect(p).rejects.toBeInstanceOf(ChatUnavailable);
  });
});

describe('chatProxyEnabled', () => {
  beforeEach(() => resetChatHealthCache());
  it('true only for JSON {enabled:true}; caches; HTML / errors / disabled -> false', async () => {
    let n = 0; const ok = (async () => { n++; return new Response('{"enabled":true}', { headers: { 'content-type': 'application/json' } }); }) as any;
    expect(await chatProxyEnabled(ok, '/h', 1000)).toBe(true); expect(await chatProxyEnabled(ok, '/h', 2000)).toBe(true); expect(n).toBe(1);
    resetChatHealthCache(); expect(await chatProxyEnabled((async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })) as any, '/h', 1)).toBe(false);
    resetChatHealthCache(); expect(await chatProxyEnabled((async () => { throw new Error('x'); }) as any, '/h', 1)).toBe(false);
    resetChatHealthCache(); expect(await chatProxyEnabled((async () => new Response('{"enabled":false}', { headers: { 'content-type': 'application/json' } })) as any, '/h', 1)).toBe(false);
  });
});

describe('rendering of model output (dangerouslySetInnerHTML)', () => {
  it('escapes HTML/script from the model, keeps **bold** and newlines', () => {
    const html = formatChatText('Hi <img src=x onerror=alert(1)> **Pro** & "q"\nnext');
    expect(html).not.toContain('<img'); expect(html).toContain('&lt;img'); expect(html).toContain('<strong>Pro</strong>'); expect(html).toContain('<br />'); expect(html).toContain('&amp;');
    expect(escapeHtml(`<'>`)).toBe('&lt;&#39;&gt;');
  });
  it('built-in answers still resolve from the shared JSON KB', () => {
    expect(CHAT_KNOWLEDGE_BASE.length).toBe(12); expect(getFallbackResponse('what is the price of pro')).toContain('Starter');
  });
});
