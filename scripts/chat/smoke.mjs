// Full-chain smoke: real browser UI -> vite preview (/api/chat routed) -> real chat-proxy -> mock OpenRouter (model 1 fails, model 2 answers).
// Usage: node scripts/chat/smoke.mjs <outdir>   (needs `vite build` output in ./dist-smoke; starts every process itself and stops them by PID)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium, devices } from 'playwright';
const out = process.argv[2] || '/tmp/chat-smoke'; fs.mkdirSync(out, { recursive: true });
const KEY = 'sk-or-mock-smoke-KEY-do-not-leak';
const procs = [];
const run = (cmd, args, env) => { const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); procs.push(p); p.out = ''; p.stdout.on('data', (d) => (p.out += d)); p.stderr.on('data', (d) => (p.out += d)); return p; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mock = run('node', ['scripts/chat/mock-openrouter.mjs'], { MOCK_PORT: '8799', MOCK_EXPECT_KEY: KEY });
const proxy = run('node', ['server/chat-proxy.mjs'], { PORT: '8787', OPENROUTER_API_KEY: KEY, OPENROUTER_BASE_URL: 'http://127.0.0.1:8799/api/v1', OPENROUTER_MODELS: 'mock/fail-1,mock/ok-2', CHAT_ALLOWED_ORIGINS: 'http://127.0.0.1:4310' });
const web = run('npx', ['vite', 'preview', '--outDir', 'dist-smoke', '--port', '4310', '--strictPort', '--host', '127.0.0.1'], { CHAT_PROXY_URL: 'http://127.0.0.1:8787' });
let ok = false; const report = {};
try {
  await sleep(4000);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [name, ctxOpts] of [['iphone14', { ...devices['iPhone 14'] }], ['desktop', { viewport: { width: 1366, height: 768 } }]]) {
    const c = await b.newContext(ctxOpts); const p = await c.newPage();
    const seen = []; p.on('request', (r) => { if (r.url().includes('/api/chat')) seen.push(r.method() + ' ' + new URL(r.url()).pathname); });
    await p.goto('http://127.0.0.1:4310/'); await p.locator('[data-testid=splash]').waitFor({ state: 'detached', timeout: 60000 });
    await p.getByRole('button', { name: 'Got it' }).evaluateAll((els) => els.forEach((e) => e.click()));
    await p.getByRole('button', { name: 'Open chat' }).click();
    await p.getByRole('textbox', { name: 'Message Melissa' }).fill('Do you work after hours?');
    await p.getByRole('button', { name: 'Send message' }).click();
    const bubble = p.locator('.whitespace-pre-wrap.break-words').last();
    // progressive: capture the text at two points in time
    await bubble.waitFor({ timeout: 15000 }); const early = await bubble.innerText(); await sleep(1200);
    await p.waitForFunction(() => /books demos/.test(document.querySelectorAll('.whitespace-pre-wrap.break-words')[document.querySelectorAll('.whitespace-pre-wrap.break-words').length - 1]?.textContent || ''), null, { timeout: 15000 });
    const final = await bubble.innerText();
    await p.screenshot({ path: `${out}/chat-${name}.png` });
    const page = await p.content();
    report[name] = { earlyLen: early.length, finalLen: final.length, progressive: early.length < final.length, final, requests: seen, keyInDom: page.includes(KEY) };
    await c.close();
  }
  await b.close();
  const proxyLog = proxy.out;
  report.proxyLogHasKey = proxyLog.includes(KEY); report.proxyFallbackLogged = /chat_model_fail/.test(proxyLog) && /chat_ok/.test(proxyLog); report.usedModel = (proxyLog.match(/"model":"(mock\/ok-2)"/) || [])[1];
  ok = report.iphone14.progressive && report.desktop.progressive && !report.iphone14.keyInDom && !report.proxyLogHasKey && report.proxyFallbackLogged && report.usedModel === 'mock/ok-2';
} finally { for (const p of procs) p.kill('SIGTERM'); }
fs.writeFileSync(`${out}/smoke-report.json`, JSON.stringify({ ok, ...report }, null, 1)); console.log(JSON.stringify({ ok, ...report }, null, 1)); process.exit(ok ? 0 : 1);
