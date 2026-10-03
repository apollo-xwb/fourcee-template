# Melissa chat via OpenRouter (server-side proxy)

Browser -> `POST /api/chat` (same origin, SSE) -> nginx -> `server/chat-proxy.mjs` (127.0.0.1:8787) -> `https://openrouter.ai/api/v1/chat/completions`.

* The key (`OPENROUTER_API_KEY`) exists only in the proxy's environment. The browser bundle contains no provider key and no provider URL
  (the old `GEMINI_API_KEY` define in `vite.config.ts` was removed; `e2e/chat.spec.ts` scans every served script for key material).
* No key / proxy not routed / proxy down / all models failing / rate limited -> the widget silently uses the built-in knowledge-base answers (same as today).
* Models are tried in order (`OPENROUTER_MODELS`, default `anthropic/claude-haiku-4.5,openai/gpt-4o-mini,google/gemini-2.5-flash`; IDs checked against the public
  OpenRouter model list on 2026-10-03). Fallback happens before the first token only; a stream that dies mid-answer ends cleanly with the partial text.
* Protection: per-IP 12/min + 150/day (configurable), max 8 in flight, 12-message / 2000-char / 32 KB input limits, Origin allow-list, first-byte 9 s, total 45 s,
  `max_tokens` 450, system prompt grounded in `server/chat-kb.json` (same facts as the offline answers; edit that one file for both).
* Model output is HTML-escaped before it is rendered (`formatChatText`).

## Enable (needs the key; NOT part of `deploy.sh`)
1. `install -m 600 /dev/null /etc/fourcee-chat.env` then add `OPENROUTER_API_KEY=...` (and optionally `OPENROUTER_MODELS=`, `CHAT_RATE_PER_MIN=` ...) - by hand, never in git/chat.
2. `cp deploy/chat/fourcee-chat.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now fourcee-chat`
3. Paste `deploy/chat/nginx-fourcee-chat.conf` into the fourcee server block, `nginx -t && systemctl reload nginx`.
4. Check: `curl -s https://fourcee.lutho.app/api/chat/health` -> `{"enabled":true,"models":3}`; open the site, chat, watch the answer stream.
Rollback: `systemctl disable --now fourcee-chat` (site falls back to built-in answers at once; the nginx block can stay).

## Local test without a key
`node scripts/chat/mock-openrouter.mjs` + `OPENROUTER_API_KEY=x OPENROUTER_BASE_URL=http://127.0.0.1:8799/api/v1 node server/chat-proxy.mjs` + `vite preview` (routes /api/chat).
`node scripts/chat/smoke.mjs <outdir>` runs the whole chain in a real browser (first model fails, second streams).
