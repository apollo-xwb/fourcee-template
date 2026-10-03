// Browser side of the Melissa chat: talks ONLY to our own /api/chat proxy (server/chat-proxy.mjs). No provider key ever exists in the bundle.
export type ChatRole = 'user' | 'assistant';
export interface ChatTurn { role: ChatRole; content: string }

export class ChatUnavailable extends Error {
  constructor(public reason: 'disabled' | 'rate_limited' | 'busy' | 'timeout' | 'network' | 'bad_response' | 'failed', public retryAfterS?: number) { super(reason); }
}

type SseEvent = { delta?: string; done?: boolean; model?: string; error?: string };

/** Parses `data: {...}` frames out of a byte stream (handles frames split across chunks, CRLF, comments). */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader(); const dec = new TextDecoder(); let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
        const frame = buf.slice(0, i); buf = buf.slice(i).replace(/^\r?\n\r?\n/, '');
        for (const line of frame.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          try { yield JSON.parse(line.slice(5).trim()) as SseEvent; } catch { /* ignore a broken frame */ }
        }
      }
    }
  } finally { try { reader.releaseLock(); } catch { /* ignore */ } }
}

export interface StreamOpts {
  messages: ChatTurn[];
  onDelta: (textSoFar: string) => void;
  fetchImpl?: typeof fetch;
  url?: string;
  signal?: AbortSignal;
  /** give up (and let the caller fall back) if the first token has not arrived by then */
  firstTokenMs?: number;
  /** hard cap for the whole answer */
  totalMs?: number;
}
export interface StreamResult { text: string; interrupted: boolean; model?: string }

export async function streamChat(o: StreamOpts): Promise<StreamResult> {
  const f = o.fetchImpl ?? fetch.bind(globalThis);
  const ac = new AbortController();
  const onOuter = () => ac.abort();
  o.signal?.addEventListener('abort', onOuter, { once: true });
  let timedOut = false;
  const first = setTimeout(() => { timedOut = true; ac.abort(); }, o.firstTokenMs ?? 12_000);
  const total = setTimeout(() => { timedOut = true; ac.abort(); }, o.totalMs ?? 60_000);
  let text = '';
  try {
    let res: Response;
    try {
      res = await f(o.url ?? '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: o.messages }), signal: ac.signal });
    } catch { throw new ChatUnavailable(timedOut ? 'timeout' : 'network'); }
    if (res.status === 429) throw new ChatUnavailable('rate_limited', Number(res.headers.get('retry-after')) || undefined);
    if (res.status === 503) { let e = ''; try { e = (await res.json()).error; } catch { /* ignore */ } throw new ChatUnavailable(e === 'chat_disabled' ? 'disabled' : e === 'busy' ? 'busy' : 'failed'); }
    if (!res.ok) throw new ChatUnavailable(res.status === 504 ? 'timeout' : 'failed');
    if (!/text\/event-stream/i.test(res.headers.get('content-type') || '') || !res.body) throw new ChatUnavailable('bad_response'); // e.g. the SPA's index.html when no proxy is routed
    let model: string | undefined; let interrupted = false;
    try {
      for await (const ev of parseSse(res.body)) {
        if (ev.delta) { if (!text) clearTimeout(first); text += ev.delta; o.onDelta(text); }
        if (ev.done) model = ev.model;
        if (ev.error) interrupted = true;
      }
    } catch {
      if (!text) throw new ChatUnavailable(timedOut ? 'timeout' : 'network');
      interrupted = true; // connection dropped mid-answer: keep what we have
    }
    if (!text.trim()) throw new ChatUnavailable('failed');
    return { text, interrupted: interrupted || (timedOut && !!text), model };
  } finally {
    clearTimeout(first); clearTimeout(total); o.signal?.removeEventListener('abort', onOuter);
  }
}

let healthCache: { at: number; enabled: boolean } | null = null;
/** One cheap GET; cached for 5 min. Lets the widget skip the network entirely (and use its local answers) when the proxy is off / not routed. */
export async function chatProxyEnabled(fetchImpl: typeof fetch = fetch.bind(globalThis), url = '/api/chat/health', now = Date.now()): Promise<boolean> {
  if (healthCache && now - healthCache.at < 300_000) return healthCache.enabled;
  let enabled = false;
  try {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 2500);
    const r = await fetchImpl(url, { signal: ac.signal, cache: 'no-store' }); clearTimeout(t);
    if (r.ok && /json/i.test(r.headers.get('content-type') || '')) enabled = (await r.json()).enabled === true;
  } catch { enabled = false; }
  healthCache = { at: now, enabled };
  return enabled;
}
export function resetChatHealthCache() { healthCache = null; }
